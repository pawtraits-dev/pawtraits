/**
 * Pawsonality quiz ways in (server only): whether the quiz is live, the link used in emails,
 * where a quiz taker came from, and marking a quiz result as "bought" when its owner orders.
 * Every way in is shown only while the quiz is live, so pausing it in admin hides them all.
 */
import { serviceClient } from '@/lib/qr/server';
import type { AnimalType } from './types';

export const QUIZ_SLUG = 'pawsonality';
const SOURCE_RE = /^[a-z0-9_-]{1,32}$/;
const BUY_WINDOW_DAYS = 30;

/** Where a quiz taker came from, e.g. 'home', 'design', 'order-email', 'shared'; null if unusable */
export function cleanSource(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().slice(0, 32);
  return SOURCE_RE.test(s) ? s : null;
}

/** Which species' quizzes are live (published and not paused) */
export async function liveAnimals(slug = QUIZ_SLUG): Promise<Record<AnimalType, boolean>> {
  const { data } = await serviceClient().from('quizzes')
    .select('animal_type, status, current_version').eq('slug', slug);
  const live = { dog: false, cat: false };
  for (const q of data ?? []) {
    if (q.status === 'live' && q.current_version > 0 && (q.animal_type === 'dog' || q.animal_type === 'cat')) live[q.animal_type as AnimalType] = true;
  }
  return live;
}

/** Quiz link for an email, or null while no quiz is live (the email then leaves the block out). Never throws. */
export async function quizEmailUrl(baseUrl: string, source: string): Promise<string | null> {
  try {
    const live = await liveAnimals();
    if (!live.dog && !live.cat) return null;
    const animal = live.dog && live.cat ? '' : `&animal=${live.dog ? 'dog' : 'cat'}`;
    return `${baseUrl.replace(/\/$/, '')}/quiz/${QUIZ_SLUG}?src=${encodeURIComponent(source)}${animal}`;
  } catch {
    return null;
  }
}

/**
 * After a paid order: the buyer's latest quiz result from the last 30 days (matched by account or
 * the email they saved it with) is marked as bought, with the order. Best effort; never throws.
 */
export async function markQuizPurchase(supabase: any, order: { id: string; customer_email?: string | null }): Promise<void> {
  try {
    const email = order.customer_email?.trim().toLowerCase();
    if (!email) return;
    const since = new Date(Date.now() - BUY_WINDOW_DAYS * 86400_000).toISOString();
    const { data: profile } = await supabase.from('user_profiles').select('user_id').eq('email', email).maybeSingle();

    let query = supabase.from('quiz_results').select('id')
      .eq('converted_to_purchase', false).gte('completed_at', since)
      .order('completed_at', { ascending: false }).limit(1);
    // Saved emails are stored lowercased; quote the value so PostgREST reads it as one literal
    const safeEmail = /^[^",()\\]+$/.test(email) ? email : null;
    if (profile?.user_id) query = query.or(`user_id.eq.${profile.user_id}${safeEmail ? `,email.eq."${safeEmail}"` : ''}`);
    else if (safeEmail) query = query.eq('email', safeEmail);
    else return;
    const { data: rows } = await query;
    const result = rows?.[0];
    if (!result) return;
    await supabase.from('quiz_results')
      .update({ converted_to_purchase: true, purchase_order_id: order.id })
      .eq('id', result.id).eq('converted_to_purchase', false);
  } catch (err) {
    console.error('quiz purchase link failed', err);
  }
}
