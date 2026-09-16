import type { NextConfig } from 'next';
const config: NextConfig = {
  typescript: { tsconfigPath: '../tsconfig.json' },
  poweredByHeader: false,
  reactStrictMode: false,
  experimental: { cpus: 2 },
};
export default config;
