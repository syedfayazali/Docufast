export const RATES = { bw: 200, color: 800 }; // default paise per page

// A shop's price list, in paise per page. duplexBw / duplexColor are optional
// double-sided prices (null = same as single-sided).
export const DEFAULT_PRICES = { bw: RATES.bw, color: RATES.color, duplexBw: null, duplexColor: null };
const MAX_PAISE = 100000; // ₹1000 per page — a typo guard, not a business rule

function cleanPaise(v, fallback, allowNull) {
  if (v === null || v === undefined || v === '') return allowNull ? null : fallback;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > MAX_PAISE) return allowNull ? null : fallback;
  return n;
}
// Always returns a complete, valid price list (bad or missing values fall back).
export function normalizePrices(p) {
  const x = p && typeof p === 'object' ? p : {};
  return {
    bw: cleanPaise(x.bw, DEFAULT_PRICES.bw, false),
    color: cleanPaise(x.color, DEFAULT_PRICES.color, false),
    duplexBw: cleanPaise(x.duplexBw, null, true),
    duplexColor: cleanPaise(x.duplexColor, null, true),
  };
}
// Strict version for owner input: throws on an out-of-range value.
export function validatePrices(p) {
  for (const k of ['bw', 'color']) {
    const n = Number(p?.[k]);
    if (!Number.isFinite(n) || n < 1 || n > MAX_PAISE) throw new Error(`${k} price must be between ₹0.01 and ₹${MAX_PAISE / 100}`);
  }
  for (const k of ['duplexBw', 'duplexColor']) {
    const v = p?.[k];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > MAX_PAISE) throw new Error(`${k} price must be between ₹0.01 and ₹${MAX_PAISE / 100}`);
  }
  return normalizePrices(p);
}
export function pricePerPage(prices, mode, duplex) {
  const p = normalizePrices(prices);
  const single = mode === 'color' ? p.color : p.bw;
  const dbl = mode === 'color' ? p.duplexColor : p.duplexBw;
  return duplex && dbl ? dbl : single;
}
// Billing: double-sided is charged per PAGE of the document at the double rate.
export function calcAmount(prices, { mode, duplex, pages, copies }) {
  return pricePerPage(prices, mode, duplex) * pages * copies;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}
