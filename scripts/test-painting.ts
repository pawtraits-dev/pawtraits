/**
 * Customer painting request (shared by the customise page and the admin size test).
 * Run: npm run test:painting
 */
let pass = 0, fail = 0;
const ok = (name: string, cond: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

(async () => {
  process.env.GEMINI_CUSTOMER_PREVIEW_SIZE = '1K';
  const { buildPaintingPrompt, paintingRequest, imageFrom, CUSTOMER_PREVIEW_SIZE } = await import('../lib/customise/painting');
  ok('customer preview size from env', CUSTOMER_PREVIEW_SIZE === '1K');
  const prompt = buildPaintingPrompt({ variationPromptTemplate: 'A regal portrait of [SUBJECT] on a throne', aspectRatio: '2:3', petCount: 1, themeName: 'Royal', styleName: 'Oil', breedName: 'Beagle' });
  ok('single-pet prompt uses the design template', prompt.length > 50 && /throne/i.test(prompt));
  const req = paintingRequest({ prompt, catalogImageData: 'data:image/png;base64,QUJD', petImageData: ['REVG', 'R0hJ'], aspectRatio: '2:3' });
  ok('contents: prompt, design, then each pet', req.contents.length === 4 && (req.contents[0] as any).text === prompt && (req.contents[1] as any).inlineData.data === 'QUJD' && (req.contents[3] as any).inlineData.data === 'R0hJ');
  ok('default size = customer preview size', req.config.imageConfig.imageSize === '1K' && req.config.imageConfig.aspectRatio === '2:3');
  const sizes = ['1K', '2K', '4K'].map((s) => paintingRequest({ prompt, catalogImageData: 'QUJD', petImageData: ['REVG'], aspectRatio: '2:3', imageSize: s }));
  ok('size test: only the size differs', sizes.every((r) => JSON.stringify({ ...r, config: { ...r.config, imageConfig: { ...r.config.imageConfig, imageSize: '' } } }) === JSON.stringify({ ...sizes[0], config: { ...sizes[0].config, imageConfig: { ...sizes[0].config.imageConfig, imageSize: '' } } })) && sizes.map((r) => r.config.imageConfig.imageSize).join() === '1K,2K,4K');
  const multi = buildPaintingPrompt({ aspectRatio: '3:2', petCount: 2, themeName: 'T', styleName: 'S', breedName: 'B', slotPlan: [{ label: 'Left', now: 'a sitting Beagle' }, { label: 'Right', now: 'a lying cat' }] as any });
  ok('two pets with slots → multi-pet prompt', /LEFT/.test(multi) && /RIGHT/.test(multi));
  ok('imageFrom finds the image part', imageFrom({ candidates: [{ content: { parts: [{ text: 'x' }, { inlineData: { data: 'IMG' } }] } }] }) === 'IMG' && imageFrom({}) === null);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
