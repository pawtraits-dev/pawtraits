/**
 * Checks for the product catalogue: shape families, format matching, validation.
 * Run: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-product-catalogue.ts
 */
const assert = require('node:assert/strict');
const sf = require('../lib/products/shape-family');
const { createCatalogueProduct } = require('../lib/products/catalogue-admin');

let n = 0;
const t = async (name: string, fn: () => any) => { await fn(); n++; console.log('  ✓', name); };

const formats = [
  { id: 'portrait', aspect_ratio: '2:3' }, { id: 'landscape', aspect_ratio: '3:2' },
  { id: 'square', aspect_ratio: '1:1' }, { id: 'wide', aspect_ratio: '2:1' }, { id: 'story', aspect_ratio: '9:16' },
];

(async () => {
  console.log('shape families');
  await t('2:3 and 3:2 are one family', () => {
    assert.equal(sf.familyForRatio('2:3'), 'rect_2x3'); assert.equal(sf.familyForRatio('3:2'), 'rect_2x3');
    assert.equal(sf.familyForRatio('1:1'), 'square'); assert.equal(sf.familyForRatio('2:1'), 'wide'); assert.equal(sf.familyForRatio('9:16'), null);
  });
  await t('a 2:3-family print is offered on portrait and landscape designs only', () => {
    const ids = sf.formatIdsForProduct({ shape_family: 'rect_2x3' }, formats);
    assert.deepEqual(ids, ['portrait', 'landscape']);
    const p = { shape_family: 'rect_2x3', format_ids: ids };
    assert.ok(sf.productMatchesFormat(p, 'landscape'));
    assert.ok(!sf.productMatchesFormat(p, 'square'));
  });
  await t('digital downloads go on every design', () => {
    assert.ok(sf.productMatchesFormat({ shape_family: 'any' }, 'story'));
    assert.equal(sf.formatIdsForProduct({ shape_family: 'any' }, formats).length, formats.length);
  });
  await t('legacy products still match their one format', () => {
    assert.ok(sf.productMatchesFormat({ format_id: 'square' }, 'square'));
    assert.ok(!sf.productMatchesFormat({ format_id: 'square' }, 'portrait'));
    assert.deepEqual(sf.formatIdsForProduct({ format_id: 'square' }, formats), ['square']);
  });
  await t('sizes turn for landscape designs', () => {
    assert.equal(sf.orientedSize({ width_cm: 20, height_cm: 30 }, 'portrait'), '20×30 cm');
    assert.equal(sf.orientedSize({ width_cm: 20, height_cm: 30 }, 'landscape'), '30×20 cm');
    assert.equal(sf.orientedSize({ width_cm: 30, height_cm: 20 }, 'portrait'), '20×30 cm');
  });

  console.log('validation (rejected before touching the database)');
  const base = { product_type: 'physical_print', medium_id: 'm', shape_family: 'rect_2x3', size_name: 'Medium', size_code: 'M', width_cm: 20, height_cm: 30, price_pence: 3500 };
  const db: any = { from() { throw new Error('should not reach the database'); } };
  const bad = async (patch: any, re: RegExp) => assert.rejects(createCatalogueProduct(db, { ...base, ...patch }), re);
  await t('needs a price in range', () => bad({ price_pence: 10 }, /Price must be/));
  await t('needs a print size', () => bad({ width_cm: null }, /print size/));
  await t('a print can\'t be "all designs"', () => bad({ shape_family: 'any' }, /design shape/));
  await t('square needs equal sides', () => bad({ shape_family: 'square' }, /equal width and height/));
  await t('size code format', () => bad({ size_code: 'medium' }, /Size code/));
  await t('junk Gelato SKU rejected', () => bad({ gelato_sku: 'x' }, /Gelato SKU/));
  await t('negative cost rejected', () => bad({ unit_cost_pence: -5 }, /Unit cost/));

  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('\n✗ FAILED:', e); process.exit(1); });
