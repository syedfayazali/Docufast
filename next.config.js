/** @type {import('next').NextConfig} */
module.exports = {
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/admin', destination: '/admin.html' },
      { source: '/signage', destination: '/signage.html' },
    ];
  },
};
