/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three@0.136 ships ESM under examples/jsm; transpile so Next 14 bundles it cleanly.
  transpilePackages: ['three'],
};

export default nextConfig;
