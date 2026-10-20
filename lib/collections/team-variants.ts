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
import { after } from 'next/server';
import { LEAGUES, sceneRecolour, teamByPath, type League } from './sports-teams';
import { letteringMatches, readKit, readShirt } from './kit-lettering';
import { generateWithUsage } from '@/lib/ai/usage';

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

/** Lettering and logo check of a personalised-kit team version */
export interface KitCheck { name: string | null; number: number | null; logos: boolean; ok: boolean }

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

/** scene: the instruction is complete (whole-scene recolour), so don't add the keep-the-background rule */
export type RecolourFn = (pngBase64: string, instruction: string, opts?: { scene?: boolean }) => Promise<string | null>;
export type UploadFn = (buffer: Buffer, filename: string, opts: { folder?: string; tags?: string[] }) => Promise<{ public_id: string; secure_url: string; bytes: number; version?: number | string; signature?: string }>;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not fetch the design (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

/** Gemini edit: same picture, outfit recoloured */
const geminiRecolour: RecolourFn = async (pngBase64, instruction, opts) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key is required');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await generateWithUsage(ai, { feature: 'team-version' }, {
    model: GEMINI_IMAGE_MODELS.pro,
    config: geminiImageConfig(ratioOfImage(pngBase64)),
    contents: [
      { text: opts?.scene ? instruction : `${instruction} Keep every animal exactly as it is: same breed, face, markings, expression, pose and place in the picture, and the same number of animals. Keep the art style, composition, background and every other detail unchanged.` },
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
    const { imageId, check } = await paintTeamVersion(input.sourceId, input.team, input.recolour ?? geminiRecolour, input.upload ?? uploadImageBufferToCloudinary, input.fetchImage ?? fetchAsBase64);
    await supabase.from('design_team_variants').update({ status: 'done', image_id: imageId, error: null, ...(check ? { kit_check: check } : {}), updated_at: new Date().toISOString() }).eq('id', jobId);
    // Its own title and description, written for the team's fans (after the response when we can)
    const describe = () => describeTeamVersion(imageId, input.team).catch(e => console.warn('team version description failed', imageId, e));
    try { after(describe); } catch { await describe(); }
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

async function paintTeamVersion(sourceId: string, team: OfferedTeam, recolour: RecolourFn, upload: UploadFn, fetchImage: (url: string) => Promise<string>): Promise<{ imageId: string; check: KitCheck | null }> {
  const supabase = serviceClient();
  const { data: source } = await supabase.from('image_catalog')
    .select('id, prompt_text, description, marketing_description, cloudinary_public_id, public_url, breed_id, coat_id, theme_id, style_id, format_id, display_tags, is_multi_subject, subjects, generation_parameters, composition_metadata, variation_prompt_template')
    .eq('id', sourceId).maybeSingle();
  if (!source) throw new Error('Design not found');
  // Separate read: works before the 2026-10-20 migration has added the column
  const { data: kitRow } = await supabase.from('image_catalog').select('kit_personalisation').eq('id', sourceId).maybeSingle();
  const kitSettings = (kitRow as any)?.kit_personalisation ?? null;

  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const url = source.cloudinary_public_id && cloud
    ? `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1536,h_1536/f_png/${source.cloudinary_public_id}`
    : source.public_url;
  const base64 = await fetchImage(url);

  // Several pets: every one of them changes kit (multi-pet plan phase 1)
  const pets = Math.max(1, Array.isArray(source.subjects) ? source.subjects.length : 0,
    Array.isArray(source.generation_parameters?.subjects) ? source.generation_parameters.subjects.length : 0);
  // Personalised-kit designs: the whole scene changes team (players and fans), lettering kept
  const kit = readKit(kitSettings);
  const sportsTeam = kit?.scene ? teamByPath(team.path) : null;
  const instruction = sportsTeam ? sceneRecolour(sportsTeam, pets) : recolourFor(team.recolour, pets);
  const painted = await recolour(base64, instruction, { scene: !!sportsTeam });
  if (!painted) throw new Error('The picture service returned no image');
  // Lettering and logo check (shown in Admin → Team versions)
  const check = kit ? await readShirt(painted, 'image/png', { imageId: sourceId }) : null;

  const slug = team.path.split('/').slice(1).join('-');
  const filename = `team-${slug}-${sourceId.slice(0, 8)}.png`;
  const uploaded = await upload(Buffer.from(painted, 'base64'), filename, {
    folder: 'pawtraits/team-versions', tags: ['team-version', `team-${slug}`],
  });

  const { data: saved, error } = await supabase.from('image_catalog').insert({
    filename, original_filename: filename, file_size: uploaded.bytes, mime_type: 'image/png',
    storage_path: `cloudinary:${uploaded.public_id}`, public_url: uploaded.secure_url,
    prompt_text: `${source.prompt_text || ''}\n\n[Team version] ${instruction}`.trim(),
    ...(kitSettings ? { kit_personalisation: kitSettings } : {}),
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
  return { imageId: saved.id, check: check && kit ? { name: check.name, number: check.number, logos: check.logos, ok: letteringMatches(check, kit.name, kit.number) && !check.logos } : null };
}

/** The team's recolour instruction, worded for every pet when the design has more than one */
export function recolourFor(instruction: string, pets: number): string {
  if (pets <= 1) return instruction;
  return instruction.replace(/^Recolour the pet's sports outfit( \(and its scarf, if it has one\))?/, `There are ${pets} pets. Recolour every pet's sports outfit (and scarf, if they have one), all in the same team kit,`)
    .replace(/Keep the same type of garment/, 'Keep each pet’s type of garment');
}

/**
 * A fresh title and description for a team version, written by Claude from the picture itself and
 * aimed at that team's fans (club name and nicknames, never generic). The shirt's sample name is
 * left out: customers put their own pet's name on it. Saved on the version's image_catalog row.
 */
export async function describeTeamVersion(imageId: string, team: Pick<OfferedTeam, 'name' | 'short' | 'path' | 'nicknames'>): Promise<string | null> {
  const supabase = serviceClient();
  const { data: row } = await supabase.from('image_catalog').select('id, cloudinary_public_id, public_url, breeds:breed_id (name)').eq('id', imageId).maybeSingle();
  if (!row) return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const url = row.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1024,h_1024/f_jpg,q_85/${row.cloudinary_public_id}` : row.public_url;
  const sportsTeam = teamByPath(team.path);
  const { data: kitRow } = await supabase.from('image_catalog').select('kit_personalisation').eq('id', imageId).maybeSingle();
  const kit = readKit((kitRow as any)?.kit_personalisation);
  const nick = (sportsTeam?.nicknames ?? team.nicknames ?? []).filter(n => n.length > 3 && !/fc$/i.test(n)).slice(0, 4);
  const context = [
    `This pet is a devoted ${team.name} supporter: the shirt, the players and the crowd are all in ${team.short} colours${sportsTeam ? ` (${sportsTeam.colours.map(c => c.name).join(' and ')})` : ''}.`,
    `Write the title and description for ${team.short} fans: name the club in the title, and work in the club, its colours and fan culture naturally${nick.length ? ` (nicknames fans use: ${nick.join(', ')})` : ''}, so it reads as made for ${team.short} supporters and not as a generic football picture.`,
    kit ? `The name and number on the shirt are a placeholder that each customer replaces with their own pet's, so never use the name "${kit.name}" or the number ${kit.number ?? ''}; call the pet "this ${(row as any).breeds?.name || 'pup'}" or similar.` : '',
    'Do not mention crests, sponsors, logos or official merchandise, and do not name real players.',
  ].filter(Boolean).join(' ');
  const { ImageDescriptionGenerator } = await import('@/lib/image-description-generator');
  const text = (await new ImageDescriptionGenerator().generateDescription(url, (row as any).breeds?.name ?? undefined, undefined, context))?.trim();
  if (!text || text === 'Unable to generate description') return null;
  await supabase.from('image_catalog').update({ description: text }).eq('id', imageId);
  return text;
}

/** Show (or hide) a team version on its team's collection page */
export async function setTeamVersionPublished(imageId: string, teamCollectionId: string, publish: boolean): Promise<void> {
  const supabase = serviceClient();
  if (publish) {
    const { error } = await supabase.from('design_collections')
      .upsert({ image_id: imageId, collection_id: teamCollectionId, source: 'team', excluded: false }, { onConflict: 'image_id,collection_id' });
    if (error) throw new Error(error.message.includes('source_check') ? 'Run the 2026-10-21-team-version-pages migration first' : error.message);
  } else {
    await supabase.from('design_collections').delete().eq('image_id', imageId).eq('collection_id', teamCollectionId).eq('source', 'team');
  }
}
