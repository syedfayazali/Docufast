// One CSV cell, safe for Excel (customer-controlled filenames can't inject formulas).
export const csvCell = v => {
  if (v === null || v === undefined) return '';
  let t = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
export const csvHead = ['Code', 'Created (IST)', 'Printed (IST)', 'Shop', 'File', 'Pages', 'Copies', 'Colour', 'Double-sided', 'Amount (INR)', 'Status', 'Refunded (INR)'];
export const csvRow = r => [
  r.code, r.created, r.printed, r.shop, r.filename, r.pages, r.copies,
  r.color_mode === 'color' ? 'Colour' : 'B&W', r.duplex ? 'Yes' : 'No',
  (r.amount / 100).toFixed(2), r.status, r.refund_amount ? (r.refund_amount / 100).toFixed(2) : '',
].map(csvCell).join(',');
