/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

module.exports = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return {
      // On the software subdomain the home page is the software landing page.
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: 'software.docufastindia.com' }], destination: '/software.html' },
      ],
      afterFiles: [
      { source: '/', destination: '/index.html' },
      { source: '/admin', destination: '/admin.html' },
      { source: '/signage', destination: '/signage.html' },
      { source: '/owner', destination: '/owner.html' },
      { source: '/software', destination: '/software.html' },
      ],
    };
  },
};
