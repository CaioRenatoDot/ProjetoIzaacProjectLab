/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O fluxo real de ponta a ponta compila em `.next-e2e`, sem tocar o `.next` do `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@filas/ui'],
};

export default nextConfig;
