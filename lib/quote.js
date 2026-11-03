import { calcAmount } from '@/lib/pricing';
import { billingState, getPlan } from '@/lib/plans';
import { resolveShop, getActiveService, checkCoupon } from '@/lib/db';

// One place that turns an order's choices into money, used by both the live
// coupon check and the real order creation so they can never disagree.
// Returns { shop, service, subtotal, discount, coupon, total } or { error }.
export async function quoteOrder({ shopSlug, serviceId, colorMode, duplex, pages, copies, couponCode }) {
  const shop = await resolveShop(shopSlug);
  // Shops whose plan has run out stop taking new online orders (paid jobs still print).
  const bill = billingState(shop);
  if (bill.state === 'expired') return { error: 'This shop is not taking online orders right now. Please ask at the counter.' };
  const pageCount = Math.min(100000, Math.max(1, parseInt(pages, 10) || 1));
  const copyCount = Math.min(500, Math.max(1, parseInt(copies, 10) || 1));
  const mode = colorMode === 'color' ? 'color' : 'bw';
  let subtotal = calcAmount(shop?.prices, { mode, duplex: !!duplex, pages: pageCount, copies: copyCount });
  let service = null;
  if (serviceId) {
    service = await getActiveService(serviceId);
    if (!service) return { error: 'That service is not available right now.' };
    subtotal += service.fee;
  }
  let discount = 0, coupon = null;
  if (couponCode) {
    const pl = getPlan(shop?.plan);
    if (pl && !pl.coupons) return { error: 'Coupon codes are not available at this shop.', couponError: true };
    const c = await checkCoupon(couponCode, subtotal);
    if (!c.ok) return { error: c.message, couponError: true };
    discount = c.discount; coupon = c.coupon;
  }
  return { shop, service, subtotal, discount, coupon, total: subtotal - discount };
}

// Several files in one order. Each file is priced by the shop's own rates; the coupon is checked
// once against the whole subtotal and its discount is shared out across the files so every file's
// own amount still adds up to exactly what the customer pays.
export const MAX_BATCH_FILES = 10;
export async function quoteBatch({ shopSlug, items, couponCode }) {
  if (!Array.isArray(items) || !items.length) return { error: 'Add at least one file.' };
  if (items.length > MAX_BATCH_FILES) return { error: `You can send up to ${MAX_BATCH_FILES} files in one order.` };
  const shop = await resolveShop(shopSlug);
  const bill = billingState(shop);
  if (bill.state === 'expired') return { error: 'This shop is not taking online orders right now. Please ask at the counter.' };
  const lines = items.map(it => {
    const pages = Math.min(100000, Math.max(1, parseInt(it.pages, 10) || 1));
    const copies = Math.min(500, Math.max(1, parseInt(it.copies, 10) || 1));
    const mode = it.colorMode === 'color' ? 'color' : 'bw';
    const duplex = !!it.duplex;
    return { pages, copies, mode, duplex, subtotal: calcAmount(shop?.prices, { mode, duplex, pages, copies }) };
  });
  const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
  let discount = 0, coupon = null;
  if (couponCode) {
    const pl = getPlan(shop?.plan);
    if (pl && !pl.coupons) return { error: 'Coupon codes are not available at this shop.', couponError: true };
    const c = await checkCoupon(couponCode, subtotal);
    if (!c.ok) return { error: c.message, couponError: true };
    discount = c.discount; coupon = c.coupon;
  }
  let left = discount;
  lines.forEach((l, i) => {
    const share = i === lines.length - 1 ? left : Math.min(left, Math.floor(discount * l.subtotal / (subtotal || 1)));
    l.discount = share; left -= share; l.total = l.subtotal - share;
  });
  return { shop, lines, subtotal, discount, coupon, total: subtotal - discount };
}
