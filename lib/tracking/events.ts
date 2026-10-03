'use client';
/**
 * Marketing/analytics events. Safe to call anywhere: no-ops until the tags have loaded
 * (and they only load after consent). GA4 + Google Ads via gtag, Meta via fbq.
 *
 * Retargeting relies on: ViewContent/view_item on every customise page,
 * CustomizeProduct when a preview is requested, AddToCart, InitiateCheckout, Purchase.
 */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export interface TrackItem {
  id: string;           // catalogue image id (or stock ref) — what audiences key on
  name?: string;
  category?: string;    // e.g. theme
  variant?: string;     // e.g. size or "custom"
  price?: number;       // pounds
  quantity?: number;
}

const currency = 'GBP';

function gtagEvent(name: string, params: Record<string, any>) {
  try { window.gtag?.('event', name, params); } catch { /* ignore */ }
}
function fbqTrack(name: string, params: Record<string, any>, eventId?: string, custom = false) {
  try {
    if (!window.fbq) return;
    window.fbq(custom ? 'trackCustom' : 'track', name, params, eventId ? { eventID: eventId } : undefined);
  } catch { /* ignore */ }
}

const gaItems = (items: TrackItem[]) => items.map(i => ({
  item_id: i.id, item_name: i.name, item_category: i.category, item_variant: i.variant, price: i.price, quantity: i.quantity ?? 1,
}));
const value = (items: TrackItem[]) => items.reduce((t, i) => t + (i.price ?? 0) * (i.quantity ?? 1), 0);

export const track = {
  /** Customise page viewed (retargeting audience source) */
  viewCustomise(item: TrackItem, source?: string) {
    gtagEvent('view_item', { currency, value: item.price ?? 0, items: gaItems([item]), source });
    fbqTrack('ViewContent', { content_ids: [item.id], content_type: 'product', content_name: item.name, content_category: item.category, currency, value: item.price ?? 0 });
  },
  photoAdded(item: TrackItem) {
    gtagEvent('pet_photo_added', { item_id: item.id });
    fbqTrack('PetPhotoAdded', { content_ids: [item.id] }, undefined, true);
  },
  /** Preview requested — Meta standard "CustomizeProduct" */
  previewRequested(item: TrackItem) {
    gtagEvent('generate_preview', { item_id: item.id, item_name: item.name });
    fbqTrack('CustomizeProduct', { content_ids: [item.id], content_type: 'product', content_name: item.name });
  },
  previewReady(item: TrackItem) {
    gtagEvent('preview_ready', { item_id: item.id });
    fbqTrack('PreviewReady', { content_ids: [item.id] }, undefined, true);
  },
  /** Quiz funnel (spec 5.5): start → each answer → complete → share / design click / save */
  quizStart(quiz: string, petType: string, source?: string) {
    gtagEvent('quiz_start', { quiz_type: quiz, pet_type: petType, ...(source ? { entry_source: source } : {}) });
  },
  quizAnswer(quiz: string, questionNumber: number, total: number) {
    gtagEvent('quiz_answer', { quiz_type: quiz, question_number: questionNumber, total_questions: total });
  },
  quizComplete(quiz: string, resultType: string, petType: string) {
    gtagEvent('quiz_complete', { quiz_type: quiz, result_type: resultType, pet_type: petType });
    fbqTrack('QuizCompleted', { quiz_type: quiz, result_type: resultType, pet_type: petType }, undefined, true);
  },
  quizShare(quiz: string, resultType: string, method: string) {
    gtagEvent('share', { content_type: 'quiz_result', item_id: resultType, method, quiz_type: quiz });
  },
  quizResultDesignClick(quiz: string, resultType: string, imageId: string) {
    gtagEvent('quiz_result_design_click', { quiz_type: quiz, result_type: resultType, item_id: imageId });
  },
  /** Site search (GA4 standard "search") and "See more <tag>" links */
  search(term: string, results: number, kind: 'query' | 'tag' = 'query') {
    gtagEvent('search', { search_term: term, results, search_kind: kind });
    fbqTrack('Search', { search_string: term }, undefined, false);
  },
  buyThisPrintClicked(item: TrackItem, mode: 'stall' | 'online') {
    gtagEvent('select_item', { items: gaItems([item]), item_list_name: mode === 'stall' ? 'stall_take_home' : 'buy_this_print' });
  },
  addToCart(items: TrackItem[]) {
    gtagEvent('add_to_cart', { currency, value: value(items), items: gaItems(items) });
    fbqTrack('AddToCart', { content_ids: items.map(i => i.id), content_type: 'product', currency, value: value(items) });
  },
  beginCheckout(items: TrackItem[]) {
    gtagEvent('begin_checkout', { currency, value: value(items), items: gaItems(items) });
    fbqTrack('InitiateCheckout', { content_ids: items.map(i => i.id), content_type: 'product', currency, value: value(items), num_items: items.length });
  },
  /** eventId must equal the server-side Conversions API event_id for de-duplication (use the PaymentIntent id) */
  purchase(orderId: string, eventId: string, totalPounds: number, items: TrackItem[]) {
    gtagEvent('purchase', { transaction_id: orderId, currency, value: totalPounds, items: gaItems(items) });
    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
    if (adsId && label) gtagEvent('conversion', { send_to: `${adsId}/${label}`, value: totalPounds, currency, transaction_id: orderId });
    fbqTrack('Purchase', { content_ids: items.map(i => i.id), content_type: 'product', currency, value: totalPounds, num_items: items.length }, eventId);
  },
};
