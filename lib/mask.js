// Masks Aadhaar-style numbers (12 digits, optionally spaced or dashed) so only
// the last 4 are ever stored or shown, e.g. "aadhaar 1234 5678 9012.pdf"
// becomes "aadhaar XXXX XXXX 9012.pdf". Customers often put the number in the
// file name; the file contents are the customer's own document and are
// printed as supplied.
const AADHAAR = /(?<!\d)(\d{4})([ -]?)(\d{4})([ -]?)(\d{4})(?!\d)/g;
export function maskAadhaar(text) {
  return String(text == null ? '' : text).replace(AADHAAR, (_m, _a, s1, _b, s2, c) => `XXXX${s1}XXXX${s2}${c}`);
}
