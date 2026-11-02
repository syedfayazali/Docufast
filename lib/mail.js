// Sends the sign-in code. Uses Resend (https://resend.com): set RESEND_API_KEY and MAIL_FROM
// (an address on a domain verified in Resend, e.g. "DocuFast India <login@docufastindia.com>").
export function mailConfigured() { return !!process.env.RESEND_API_KEY; }

export async function sendLoginCode(to, code) {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #E2E6EE;border-radius:14px">
  <div style="font-size:22px;font-weight:700;color:#0A2E6E">Docu<span style="color:#F4B000">Fast</span> India</div>
  <p style="color:#14213D;font-size:15px;margin:18px 0 6px">Your sign-in code</p>
  <div style="font-size:34px;letter-spacing:8px;font-weight:700;color:#0A2E6E;background:#E7ECF7;border-radius:10px;padding:14px;text-align:center">${code}</div>
  <p style="color:#5B6478;font-size:13px;margin-top:16px">Enter this in the DocuFast app. It works for 10 minutes. If you did not ask for it, ignore this email.</p></div>`;
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('mail not configured');
    console.log(`[dev] sign-in code for ${to}: ${code}`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'DocuFast India <onboarding@resend.dev>', to: [to], subject: `${code} is your DocuFast sign-in code`, html, text: `Your DocuFast sign-in code is ${code}. It works for 10 minutes.` }),
  });
  if (!r.ok) throw new Error('mail failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
