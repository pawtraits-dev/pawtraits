/** Labels and number formats for Admin > AI costs */
export const FEATURES: Record<string, string> = {
  'customer-painting': 'Customer paintings',
  'customer-variation': 'Customer variations',
  'public-variation': 'Try-it variations',
  'admin-variation': 'Admin variations',
  'admin-preview': 'Admin test variation',
  'team-version': 'Team versions',
  'print-master': '4K print masters',
  mug: 'Mugs',
  'quiz-image': 'Quiz pictures',
  'size-test': 'Size tests (admin)',
  'gemini-test': 'Gemini test page',
  'auto-tag': 'Auto-tagging',
  'photo-check': 'Social photo check',
  'pet-count': 'Pet count check',
  description: 'Descriptions',
  'composition-analysis': 'Composition analysis',
  'theme-from-image': 'Theme from image',
  'social-message': 'Social messages',
  'progress-messages': 'Progress messages',
  other: 'Other',
};

export const num = (v: unknown) => Number(v ?? 0);
export const usd = (v: number) => (v === 0 ? '$0' : Math.abs(v) < 1 ? `$${v.toFixed(v < 0.01 ? 4 : 3)}` : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const int = (v: number) => Math.round(v).toLocaleString('en-GB');
