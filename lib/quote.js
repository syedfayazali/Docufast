import { calcAmount } from '@/lib/pricing';
import { resolveShop, getActiveService, checkCoupon } from '@/lib/db';

// One place that turns an order's choices into money, used by both the live
// coupon check and the real order creation so they can never disagree.
// Returns { shop, service, subtotal, discount, coupon, total } or { error }.
export async function quoteOrder({ shopSlug, serviceId, colorMode, duplex, pages, copies, couponCode }) {
  const shop = await resolveShop(shopSlug);
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
    const c = await checkCoupon(couponCode, subtotal);
    if (!c.ok) return { error: c.message, couponError: true };
    discount = c.discount; coupon = c.coupon;
  }
  return { shop, service, subtotal, discount, coupon, total: subtotal - discount };
}
