/**
 * Sports team switcher (server only). Spec: docs/specs/collections-plan.md, phase 4.
 *
 * A sports design (one filed under a team or a league) can be repainted in another team's
 * colours with a Gemini edit ("recolour the sports outfit to Chiefs colours…"). Each design +
 * team version is made once, saved as a link-only design (tag quiz-generated, so it never shows
 * in listings) and tracked in design_team_variants. On the design page, picking a team simply
 * opens that version's own design page, so "Add my pet's photo" and buying work unchanged.
 *
 * Which teams a design offers: its own league (colleges for college designs) unless the admin
 * set image_catalog.team_switch to 'any' (every team) or 'off'.
 */
import { GoogleGenAI } from '@google/genai';
import { serviceClient } from '@/lib/qr/server';
import { uploadImageBufferToCloudinary } from '@/lib/cloudinary-server';
import { GEMINI_IMAGE_MODELS, geminiImageConfig, ratioOfImage } from '@/lib/gemini-models';
import { LEAGUES, type League } from './sports-teams';

export const VARIANT_TAG = 'team-variant';
const UNLISTED_TAG = 'quiz-generated'; // lib/catalog/listing.ts: "link-only, not in listings"
const STALE_MS = 4 * 60_000;
const MAX_ATTEMPTS = 2;
const LEAGUE_ORDER: League[] = ['premier-league', 'nfl', 'nba', 'nhl', 'college'];

export interface OfferedTeam {
  id: string; path: string; league: League; name: string; short: string; nicknames: string[];
  colours: { name: string; hex: string }[]; recolour: string; outfitId: string | null;
  imageId: string | null;      // ready version (the original design for its own team)
  status: 'ready' | 'running' | 'failed' | 'none';
}

export interface TeamContext {
  sourceId: string;
  scope: 'league' | 'any' | 'off';
  homeTeamPath: string | null;
  homeLeague: League | null;
  currentTeamPath: string | null;
  teams: OfferedTeam[];
}

export type VariantResult =
  | { status: 'done'; imageId: string }
  | { status: 'pending' }
  | { status: 'failed'; error?: string }
  | { status: 'unavailable'; reason: string };

const isVisibleSource = (row: any) => row && row.is_public !== false && !row.is_customer_generated;

/**
 * The switcher's view of a design (or of one of its team versions): the original design, its
 * team and league, the teams it offers and which versions are already made. Null when the
 * design isn't a sports design.
 */
export async function teamContext(supabase: any, imageId: string): Promise<TeamContext | null> {
  // A team version → work from its original
  const { data: asVariant } = await supabase.from('design_team_variants')
    .select('source_image_id, team_collection_id, collections:team_collection_id (path)').eq('image_id', imageId).eq('status', 'done').maybeSingle();
  const sourceId: string = asVariant?.source_image_id ?? imageId;

  const { data: source } = await supabase.from('image_catalog')
    .select('id, is_public, is_customer_generated, team_switch, tags').eq('id', sourceId).maybeSingle();
  if (!isVisibleSource(source) || (source.tags ?? []).includes(VARIANT_TAG)) return null;

  const { data: links } = await supabase.from('design_collections')
    .select('collections!inner (id, path, depth, kind, is_active)').eq('image_id', sourceId).eq('excluded', false);
  const sport = (links ?? []).map((l: any) => l.collections).filter((c: any) => c?.kind === 'sport' && c.is_active && c.depth >= 1);
  if (!sport.length) return null;
  const home = sport.find((c: any) => c.depth === 2) ?? null;
  const homeLeague = ((home ?? sport[0]).path.split('/')[1] ?? null) as League | null;
  const scope: TeamContext['scope'] = source.team_switch === 'any' ? 'any' : source.team_switch === 'off' ? 'off' : 'league';

  const { data: cols } = await supabase.from('collections')
    .select('id, path, name, short_name, metadata, outfit_id, sort_order, search_terms').eq('kind', 'sport').eq('depth', 2).eq('is_active', true).order('sort_order');
  const { data: variants } = await supabase.from('design_team_variants')
    .select('team_collection_id, image_id, status, updated_at').eq('source_image_id', sourceId);
  const byTeam = new Map<string, any>((variants ?? []).map((v: any) => [v.team_collection_id, v]));

  const teams: OfferedTeam[] = (cols ?? [])
    .filter((c: any) => c.metadata?.recolour_prompt && (scope === 'any' || c.path.split('/')[1] === homeLeague || c.path === home?.path))
    .map((c: any) => {
      const v = byTeam.get(c.id);
      const isHome = c.path === home?.path;
      const running = v?.status === 'running' && Date.now() - new Date(v.updated_at).getTime() < STALE_MS;
      return {
        id: c.id, path: c.path, league: c.path.split('/')[1] as League, name: c.name, short: c.short_name || c.name,
        nicknames: (c.search_terms ?? []).slice(0, 6), colours: c.metadata?.colours ?? [], recolour: c.metadata.recolour_prompt, outfitId: c.outfit_id,
        imageId: isHome ? sourceId : v?.status === 'done' ? v.image_id : null,
        status: isHome || (v?.status === 'done' && v.image_id) ? 'ready' : running ? 'running' : v?.status === 'failed' ? 'failed' : 'none',
      } as OfferedTeam;
    })
    .sort((a: OfferedTeam, b: OfferedTeam) => LEAGUE_ORDER.indexOf(a.league) - LEAGUE_ORDER.indexOf(b.league));

  return {
    sourceId, scope: teams.length > 1 ? scope : 'off', homeTeamPath: home?.path ?? null, homeLeague,
    currentTeamPath: asVariant ? (asVariant.collections as any)?.path ?? null : home?.path ?? null,
    teams: scope === 'off' ? [] : teams,
  };
}

/** Teams grouped by league, for the picker */
export function groupByLeague(teams: OfferedTeam[]) {
  return LEAGUE_ORDER.map(lg => ({ league: lg, name: LEAGUES[lg].name, teams: teams.filter(t => t.league === lg) })).filter(g => g.teams.length);
}

export type RecolourFn = (pngBase64: string, instruction: string) => Promise<string | null>;
export type UploadFn = (buffer: Buffer, filename: string, opts: { folder?: string; tags?: string[] }) => Promise<{ public_id: string; secure_url: string; bytes: number; version?: number | string; signature?: string }>;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not fetch the design (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

/** Gemini edit: same picture, outfit recoloured */
const geminiRecolour: RecolourFn = async (pngBase64, instruction) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key is required');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODELS.pro,
    config: geminiImageConfig(ratioOfImage(pngBase64)),
    contents: [
      { text: `${instruction} Keep every animal exactly as it is: same breed, face, markings, expression, pose and place in the picture, and the same number of animals. Keep the art style, composition, background and every other detail unchanged.` },
      { inlineData: { mimeType: 'image/png', data: pngBase64 } },
    ],
  });
  for (const part of response.candidates?.[0]?.content?.parts ?? []) if (part.inlineData?.data) return part.inlineData.data;
  return null;
};

/**
 * Make (or reuse) the team version. Claims the job first so two people asking at once don't
 * paint it twice: the claimer generates (20–60 s); everyone else gets 'pending'.
 */
export async function ensureTeamVariant(input: {
  sourceId: string; team: OfferedTeam; requestedBy: 'customer' | 'admin'; ipHash?: string | null;
  recolour?: RecolourFn; upload?: UploadFn; fetchImage?: (url: string) => Promise<string>;   // swappable in tests
}): Promise<VariantResult> {
  const supabase = serviceClient();
  if (input.team.imageId) return { status: 'done', imageId: input.team.imageId };

  const { data: existing } = await supabase.from('design_team_variants')
    .select('id, status, image_id, attempts, updated_at').eq('source_image_id', input.sourceId).eq('team_collection_id', input.team.id).maybeSingle();
  let jobId: string;
  if (!existing) {
    const { data: created, error } = await supabase.from('design_team_variants').insert({
      source_image_id: input.sourceId, team_collection_id: input.team.id, status: 'running', attempts: 1,
      requested_by: input.requestedBy, ip_hash: input.ipHash ?? null,
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return { status: 'pending' };
      throw error;
    }
    jobId = created.id;
  } else {
    if (existing.status === 'done' && existing.image_id) return { status: 'done', imageId: existing.image_id };
    const stale = Date.now() - new Date(existing.updated_at).getTime() > STALE_MS;
    if (existing.status === 'running' && !stale) return { status: 'pending' };
    if (existing.status === 'failed' && existing.attempts >= MAX_ATTEMPTS && input.requestedBy !== 'admin') return { status: 'failed' };
    const { data: claimed } = await supabase.from('design_team_variants')
      .update({ status: 'running', attempts: existing.attempts + 1, error: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id).eq('updated_at', existing.updated_at).select('id');
    if (!claimed?.length) return { status: 'pending' };
    jobId = existing.id;
  }

  try {
    const imageId = await paintTeamVersion(input.sourceId, input.team, input.recolour ?? geminiRecolour, input.upload ?? uploadImageBufferToCloudinary, input.fetchImage ?? fetchAsBase64);
    await supabase.from('design_team_variants').update({ status: 'done', image_id: imageId, error: null, updated_at: new Date().toISOString() }).eq('id', jobId);
    return { status: 'done', imageId };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
    console.error('Team version failed', { sourceId: input.sourceId, team: input.team.path, message });
    await supabase.from('design_team_variants').update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', jobId);
    return { status: 'failed', error: message };
  }
}

/** Current state without starting anything */
export async function peekTeamVariant(sourceId: string, teamId: string): Promise<VariantResult | null> {
  const { data } = await serviceClient().from('design_team_variants')
    .select('image_id, status, error, updated_at').eq('source_image_id', sourceId).eq('team_collection_id', teamId).maybeSingle();
  if (!data) return null;
  if (data.status === 'done' && data.image_id) return { status: 'done', imageId: data.image_id };
  if (data.status === 'failed') return { status: 'failed' };
  if (Date.now() - new Date(data.updated_at).getTime() > STALE_MS) return null;
  return { status: 'pending' };
}

async function paintTeamVersion(sourceId: string, team: OfferedTeam, recolour: RecolourFn, upload: UploadFn, fetchImage: (url: string) => Promise<string>): Promise<string> {
  const supabase = serviceClient();
  const { data: source } = await supabase.from('image_catalog')
    .select('id, prompt_text, description, marketing_description, cloudinary_public_id, public_url, breed_id, coat_id, theme_id, style_id, format_id, display_tags, is_multi_subject, subjects, generation_parameters, composition_metadata, variation_prompt_template')
    .eq('id', sourceId).maybeSingle();
  if (!source) throw new Error('Design not found');

  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const url = source.cloudinary_public_id && cloud
    ? `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1536,h_1536/f_png/${source.cloudinary_public_id}`
    : source.public_url;
  const base64 = await fetchImage(url);

  // Several pets: every one of them changes kit (multi-pet plan phase 1)
  const pets = Math.max(1, Array.isArray(source.subjects) ? source.subjects.length : 0,
    Array.isArray(source.generation_parameters?.subjects) ? source.generation_parameters.subjects.length : 0);
  const painted = await recolour(base64, recolourFor(team.recolour, pets));
  if (!painted) throw new Error('The picture service returned no image');

  const slug = team.path.split('/').slice(1).join('-');
  const filename = `team-${slug}-${sourceId.slice(0, 8)}.png`;
  const uploaded = await upload(Buffer.from(painted, 'base64'), filename, {
    folder: 'pawtraits/team-versions', tags: ['team-version', `team-${slug}`],
  });

  const { data: saved, error } = await supabase.from('image_catalog').insert({
    filename, original_filename: filename, file_size: uploaded.bytes, mime_type: 'image/png',
    storage_path: `cloudinary:${uploaded.public_id}`, public_url: uploaded.secure_url,
    prompt_text: `${source.prompt_text || ''}\n\n[Team version] ${team.recolour}`.trim(),
    description: source.description, marketing_description: source.marketing_description,
    tags: [VARIANT_TAG, `team:${team.path}`, UNLISTED_TAG],
    display_tags: source.display_tags ?? [],
    breed_id: source.breed_id, coat_id: source.coat_id, theme_id: source.theme_id, style_id: source.style_id, format_id: source.format_id,
    outfit_id: team.outfitId,
    is_multi_subject: pets > 1, subjects: source.subjects, generation_parameters: source.generation_parameters ?? {}, composition_metadata: source.composition_metadata,
    variation_prompt_template: source.variation_prompt_template,
    cloudinary_public_id: uploaded.public_id, cloudinary_version: uploaded.version?.toString(), cloudinary_signature: uploaded.signature,
    rating: 4, is_featured: false, is_public: true,
  }).select('id').single();
  if (error || !saved) throw new Error(`Saving the picture failed: ${error?.message}`);

  // Same pets, same places: copy the per-pet rows (breed filters, multi-pet swaps)
  const { data: petRows } = await supabase.from('image_catalog_subjects')
    .select('subject_order, is_primary, breed_id, coat_id, position, size_prominence, pose_description, gaze_direction, expression').eq('image_catalog_id', sourceId);
  if (petRows?.length) {
    await supabase.from('image_catalog_subjects').insert(petRows.map((r: any) => ({ ...r, image_catalog_id: saved.id, outfit_id: team.outfitId })));
  }
  return saved.id;
}

/** The team's recolour instruction, worded for every pet when the design has more than one */
export function recolourFor(instruction: string, pets: number): string {
  if (pets <= 1) return instruction;
  return instruction.replace(/^Recolour the pet's sports outfit/, `There are ${pets} pets. Recolour every pet's sports outfit, all in the same team kit,`)
    .replace(/Keep the same type of garment/, 'Keep each pet’s type of garment');
}
