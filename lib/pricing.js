// Pricing — paise per page (mirrors how Razorpay/most Indian payment gateways quote amounts in paise)
export const RATES = {
  bw: 200,    // ₹2.00 per page, black & white
  color: 800, // ₹8.00 per page, color
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I — easy to read aloud

export function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
