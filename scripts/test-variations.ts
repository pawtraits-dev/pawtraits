/**
 * Saved variation batches: combinations, keys, planning, Gemini request lines and results parsing.
 * Run: npm run test:variations
 */
import { combosFor, variationKey, plan, chunk, jobStateFromGemini, estimateBatchImageCost, recipeSize, plainTitle } from '../lib/variations/combos';
import { batchRequestLine, jsonlLines } from '../lib/variations/batch';
import { GeminiVariationService } from '../lib/gemini-variation-service';

let pass = 0, fail = 0;
const ok = (name: string, cond: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

(async () => {
  const bc = (n: number) => ({ breedId: `b${n}`, coatId: `c${n}` });
  // Combinations
  const both = combosFor({ breedCoats: [bc(1), bc(2)], outfitIds: ['o1', 'o2', 'o3'] });
  ok('combined: breed/coats × outfits', both.length === 6 && both.every((c) => c.breedId && c.outfitId));
  ok('only breed/coats', combosFor({ breedCoats: [bc(1), bc(2)], outfitIds: [] }).every((c) => c.breedId && !c.outfitId));
  ok('only outfits', combosFor({ breedCoats: [], outfitIds: ['o1', 'o2'] }).length === 2);
  ok('duplicates dropped', recipeSize({ breedCoats: [bc(1), bc(1)], outfitIds: ['o1', 'o1'] }) === 1);
  ok('empty', recipeSize({ breedCoats: [], outfitIds: [] }) === 0);
  ok('NFL+NBA × 10 = 620', recipeSize({ breedCoats: Array.from({ length: 10 }, (_, i) => bc(i)), outfitIds: Array.from({ length: 62 }, (_, i) => `t${i}`) }) === 620);
  // Keys
  ok('key format', variationKey({ breedId: 'b', coatId: 'c', outfitId: 'o' }) === 'b:b|c:c|o:o');
  ok('key: outfit only', variationKey({ outfitId: 'o' }) === 'o:o');
  ok('key: same for window and batch', variationKey({ breedId: 'b1', coatId: 'c1', outfitId: null }) === both.find((c) => c.breedId === 'b1')!.key.split('|o:')[0]);
  ok('key: nothing → empty', variationKey({}) === '');
  // Planning
  const p = plan(both, new Set([both[0].key, both[3].key]));
  ok('plan skips existing keys', p.make.length === 4 && p.skipped === 2 && !p.make.some((c) => c.key === both[0].key));
  ok('plan: new reference makes everything', plan(both, new Set()).make.length === 6);
  // Jobs
  ok('chunk 45 → 20/20/5', chunk(Array.from({ length: 45 }), 20).map((c) => c.length).join() === '20,20,5');
  ok('job states', jobStateFromGemini('JOB_STATE_SUCCEEDED') === 'succeeded' && jobStateFromGemini('JOB_STATE_EXPIRED') === 'expired' && jobStateFromGemini('JOB_STATE_PENDING') === 'running' && jobStateFromGemini(undefined) === 'running');
  const e4 = estimateBatchImageCost('gemini-nano-banana-2.1', '4K'), e2 = estimateBatchImageCost('gemini-nano-banana-2.1', '2K');
  ok(`estimate 4K ≈ $0.062 (${e4.toFixed(4)}), 2K ≈ $0.031 (${e2.toFixed(4)})`, Math.abs(e4 - 0.0624) < 0.002 && Math.abs(e2 - 0.0309) < 0.002);

  ok('plain title', plainTitle('**The King** A royal portrait') === 'The King A royal portrait' && plainTitle('') === 'Design' && plainTitle('x'.repeat(100)).length === 80);

  // Gemini request line
  const line = JSON.parse(batchRequestLine({ id: 'item-1', gemini_prompt: 'Make it a beagle', metadata: { aspect_ratio: '2:3' } }, { uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc', mimeType: 'image/png' }, '4K'));
  ok('line: key', line.key === 'item-1');
  ok('line: prompt then reference file', line.request.contents[0].parts[0].text === 'Make it a beagle' && line.request.contents[0].parts[1].fileData.fileUri.endsWith('/files/abc'));
  ok('line: image only, size and shape', line.request.generationConfig.responseModalities.join() === 'IMAGE' && line.request.generationConfig.imageConfig.imageSize === '4K' && line.request.generationConfig.imageConfig.aspectRatio === '2:3');
  ok('line: no shape when unknown', !('aspectRatio' in JSON.parse(batchRequestLine({ id: 'x', gemini_prompt: 'p', metadata: {} }, { uri: 'u', mimeType: 'image/png' }, '2K')).request.generationConfig.imageConfig));

  // Results parsing: lines split across chunks, big lines, no trailing newline
  const big = 'A'.repeat(300_000);
  const text = `{"key":"a","response":{"x":"${big}"}}\n\n{"key":"b","error":{"message":"blocked"}}\n{"key":"c"}`;
  const bytes = Buffer.from(text);
  const stream = new ReadableStream<Uint8Array>({ start(ctrl) { for (let i = 0; i < bytes.length; i += 7777) ctrl.enqueue(new Uint8Array(bytes.subarray(i, i + 7777))); ctrl.close(); } });
  const keys: string[] = []; let bigOk = false;
  for await (const l of jsonlLines(stream)) { const j = JSON.parse(l); keys.push(j.key); if (j.key === 'a') bigOk = j.response.x.length === 300_000; }
  ok('jsonl: 3 lines across chunks, blank skipped', keys.join() === 'a,b,c' && bigOk);

  // Prompts for one variation (no Gemini call)
  process.env.GEMINI_API_KEY ||= 'test';
  const svc = new GeminiVariationService();
  const breed: any = { id: 'b', name: 'Beagle', slug: 'beagle', animal_type: 'dog', physical_traits: {} };
  const coat = { id: 'c', coat_name: 'Tricolor', pattern_type: 'tricolor' };
  const kit: any = { id: 'o', name: 'Kansas City Chiefs kit', clothing_description: 'an American football uniform in Chiefs colours (red and gold)' };
  const ref = 'A golden retriever with golden fur wearing a tuxedo, regal portrait --ar 2:3';
  const combo = svc.promptsFor({ originalPrompt: ref, targetBreed: breed, coat, outfit: kit });
  ok('prompt: breed + coat + team kit description', /beagle/i.test(combo.geminiPrompt) && /tricolor/i.test(combo.geminiPrompt) && combo.geminiPrompt.includes('Chiefs colours (red and gold)') && combo.variationType === 'breed_outfit');
  ok('catalogue prompt names the new breed and outfit', /beagle/i.test(combo.catalogPrompt) && /chiefs/i.test(combo.catalogPrompt));
  ok('tags', combo.tags.includes('beagle') && combo.tags.includes('breed_outfit'));
  const kitOnly = svc.promptsFor({ originalPrompt: ref, outfit: kit });
  ok('prompt: outfit only keeps the pet', kitOnly.variationType === 'outfit' && /Only change what the pet is wearing/.test(kitOnly.geminiPrompt));
  let threw = false; try { svc.promptsFor({ originalPrompt: ref }); } catch { threw = true; }
  ok('prompt: nothing to change throws', threw);
  ok('aspect ratio: format first, then prompt', svc.aspectRatioFor(ref, { aspect_ratio: '1:1' }) === '1:1' && svc.aspectRatioFor(ref, null) === '2:3');

  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
