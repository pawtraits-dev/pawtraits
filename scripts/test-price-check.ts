// Run: npm run test:price-check — checks the server-side price comparison used by /api/payments/create-intent
import { evaluatePriceCheck as e, invalidCartLine as v } from '../lib/checkout/price-check';
const t = (name: string, got: any, want: any) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : JSON.stringify(got)); if (!ok) process.exitCode = 1; };
// £20 print + £5 delivery, no discount
t('exact', e({ amount: 2500, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'ok');
t('overpay', e({ amount: 3000, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'ok');
t('1p rounding', e({ amount: 2499, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'ok');
t('unverified 10% off', e({ amount: 2300, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'low');
t('verified 10% off', e({ amount: 2300, goodsFloor: 2000, shipping: 500, discountRate: 0.10, rewardsAllowed: 0 }).status, 'ok');
t('partner 20%', e({ amount: 2100, goodsFloor: 2000, shipping: 500, discountRate: 0.20, rewardsAllowed: 0 }).status, 'ok');
t('claims 20% gets 10%', e({ amount: 2100, goodsFloor: 2000, shipping: 500, discountRate: 0.10, rewardsAllowed: 0 }).status, 'low');
t('pays £1', e({ amount: 100, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'suspicious');
t('skips delivery', e({ amount: 2000, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 0 }).status, 'low');
t('rewards cover part', e({ amount: 1500, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 1000 }).status, 'ok');
t('rewards cover all goods', e({ amount: 500, goodsFloor: 2000, shipping: 500, discountRate: 0, rewardsAllowed: 2000 }).status, 'ok');
t('digital £7.50', e({ amount: 750, goodsFloor: 750, shipping: 0, discountRate: 0, rewardsAllowed: 0 }).status, 'ok');
t('digital 10% verified (675)', e({ amount: 675, goodsFloor: 750, shipping: 0, discountRate: 0.10, rewardsAllowed: 0 }).status, 'ok');
t('half price exactly', e({ amount: 1000, goodsFloor: 2000, shipping: 0, discountRate: 0, rewardsAllowed: 0 }).status, 'low');
t('just under half', e({ amount: 999, goodsFloor: 2000, shipping: 0, discountRate: 0, rewardsAllowed: 0 }).status, 'suspicious');
t('neg qty', v([{ productId: 'a', quantity: -1, unitPrice: 100 }]), 'quantity');
t('frac qty', v([{ productId: 'a', quantity: 0.5, unitPrice: 100 }]), 'quantity');
t('neg price', v([{ productId: 'a', quantity: 1, unitPrice: -5 }]), 'unitPrice');
t('good line', v([{ productId: 'a', quantity: 2, unitPrice: 100 }]), null);
