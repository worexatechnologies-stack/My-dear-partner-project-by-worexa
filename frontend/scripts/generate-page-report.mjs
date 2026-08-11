import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const outputDir = path.resolve('reports', 'page-audit');
const reportPath = path.resolve('reports', 'my-dear-partner-page-report.pdf');

const pages = [
  ['/', 'Home', 'Public landing page introducing the platform, trust message, and primary registration path.'],
  ['/about', 'About', 'Explains the service mission, approach, and values.'],
  ['/success-stories', 'Success stories', 'Highlights relationship success stories and social proof.'],
  ['/membership', 'Membership', 'Shows membership plans, benefits, and upgrade options.'],
  ['/contact', 'Contact', 'Lets visitors send an enquiry to the My Dear Partner support team.'],
  ['/faq', 'Frequently asked questions', 'Answers common product, account, and membership questions.'],
  ['/help', 'Help centre', 'Provides guided support and help resources for visitors and members.'],
  ['/privacy', 'Privacy policy', 'Describes the handling and protection of personal information.'],
  ['/terms', 'Terms and conditions', 'Sets the rules and responsibilities for using the service.'],
  ['/refund-policy', 'Refund policy', 'Explains membership payment and refund conditions.'],
  ['/login', 'Member login', 'Secure entry point for existing member accounts.'],
  ['/register', 'Create profile', 'Registration flow for new members.'],
  ['/forgot-password', 'Forgot password', 'Allows members to request a password reset.'],
  ['/reset-password', 'Reset password', 'Completes a password reset from a valid reset link.'],
  ['/verify-otp', 'OTP verification', 'Verifies a one-time code during account access or registration.'],
  ['/admin/login', 'Admin login', 'Secure sign-in page for administrator accounts.'],
  ['/super-admin/login', 'Super-admin login', 'Secure sign-in page for platform-level administrators.'],
  ['/staff/login', 'Staff login', 'Secure sign-in page for assigned operations staff.'],
  ['/403', 'Access restricted', 'Displays when an account does not have permission to open a route.'],
  ['/session-expired', 'Session expired', 'Provides a clear recovery path when a secure session ends.'],
];

const protectedRoutes = [
  ['/dashboard', 'Member dashboard'], ['/search', 'Profile search'], ['/matches', 'Matches'], ['/shortlist', 'Shortlist'],
  ['/interests', 'Interests'], ['/messages', 'Messages'], ['/notifications', 'Notifications'], ['/profile/me', 'My profile'],
  ['/profile/edit', 'Edit profile'], ['/profile/photos', 'Profile photos'], ['/profile/documents', 'Documents'],
  ['/verification', 'Verification'], ['/settings', 'Member settings'], ['/support', 'Member support'], ['/tickets', 'Support tickets'],
  ['/admin/dashboard', 'Admin dashboard'], ['/admin/members', 'Member management'], ['/admin/profiles', 'Profile approvals'],
  ['/admin/photos', 'Photo approvals'], ['/admin/documents', 'Document approvals'], ['/admin/tickets', 'Support tickets'],
  ['/super-admin/dashboard', 'Super-admin dashboard'], ['/super-admin/members', 'Members'], ['/super-admin/photo-verifications', 'Photo approvals'],
  ['/super-admin/documents', 'Documents'], ['/super-admin/memberships', 'Memberships'], ['/super-admin/membership-plans', 'Plans'],
  ['/super-admin/settings', 'Platform settings'], ['/super-admin/activity', 'Activity logs'], ['/super-admin/backups', 'Backups'],
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const captures = [];

for (let index = 0; index < pages.length; index += 1) {
  const [route, title, description] = pages[index];
  const fileName = `${String(index + 1).padStart(2, '0')}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  const filePath = path.join(outputDir, fileName);
  let note = '';
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.screenshot({ path: filePath, fullPage: false });
    if (!response?.ok()) note = `HTTP ${response?.status() ?? 'unavailable'}`;
  } catch (error) {
    await page.screenshot({ path: filePath, fullPage: false }).catch(() => {});
    note = `Capture warning: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
  captures.push({ route, title, description, filePath, note });
}

await browser.close();

const screenshots = await Promise.all(captures.map(async (capture) => ({
  ...capture,
  image: `data:image/png;base64,${(await readFile(capture.filePath)).toString('base64')}`,
})));

const cards = screenshots.map(({ route, title, description, image, note }) => `
  <section class="page-card">
    <div class="section-heading"><h2>${escapeHtml(title)}</h2><code>${escapeHtml(route)}</code></div>
    <p>${escapeHtml(description)}</p>
    ${note ? `<p class="warning">${escapeHtml(note)}</p>` : ''}
    <img src="${image}" alt="Screenshot of ${escapeHtml(title)}" />
  </section>`).join('');

const routeRows = protectedRoutes.map(([route, title]) => `<tr><td><code>${escapeHtml(route)}</code></td><td>${escapeHtml(title)}</td></tr>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 13mm; }
  * { box-sizing: border-box; } body { font-family: Arial, sans-serif; color: #16213a; margin: 0; font-size: 11px; }
  .cover { min-height: 260mm; display:flex; flex-direction:column; justify-content:center; background:linear-gradient(140deg,#fff8fa,#eef4ff); padding:26mm; border-radius:18px; }
  .brand { color:#e63768; font-weight:800; font-size:14px; letter-spacing:1.4px; } h1 { font-size:34px; line-height:1.1; margin:12px 0; } .cover p { font-size:15px; max-width:510px; color:#53647e; line-height:1.6; }
  .meta { margin-top:24px; color:#687a96; font-size:11px; } .page-card { break-before: page; page-break-before: always; }
  .section-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; border-bottom:2px solid #f4d8e0; } h2 { margin:0 0 7px; font-size:21px; } p { color:#4e5d74; line-height:1.5; }
  code { background:#f5f7fa; color:#b21f4e; padding:4px 6px; border-radius:4px; white-space:nowrap; } img { width:100%; max-height:170mm; object-fit:contain; object-position:top; border:1px solid #dbe2ec; border-radius:8px; margin-top:8px; }
  .warning { color:#9b6515; background:#fff7e5; padding:8px; border-radius:5px; } .protected { break-before: page; page-break-before:always; } table { width:100%; border-collapse:collapse; margin-top:10px; } th,td { text-align:left; padding:8px; border-bottom:1px solid #e5eaf1; } th { background:#16213a; color:white; } .footer { color:#718099; margin-top:20px; }
</style></head><body>
<section class="cover"><div class="brand">MY DEAR PARTNER</div><h1>Website page reference</h1><p>Desktop screenshot and purpose reference for the public and sign-in experience. The report was generated from the local production host at ${escapeHtml(baseUrl)}.</p><div class="meta">Generated: ${escapeHtml(new Date().toLocaleString('en-IN'))}<br/>Viewport: 1440 × 900</div></section>
${cards}
<section class="protected"><h1>Protected portal route inventory</h1><p>These routes require a member, staff, admin, or super-admin session. They are listed here without screenshots to avoid exposing private member data in a shareable report.</p><table><thead><tr><th>Route</th><th>Purpose</th></tr></thead><tbody>${routeRows}</tbody></table><p class="footer">To create a separate authenticated portal report, use dedicated test accounts with non-production sample data.</p></section>
</body></html>`;

const pdfBrowser = await chromium.launch({ headless: true });
const pdfPage = await pdfBrowser.newPage();
await pdfPage.setContent(html, { waitUntil: 'load' });
await pdfPage.pdf({ path: reportPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
await pdfBrowser.close();

console.log(`Created ${reportPath}`);
