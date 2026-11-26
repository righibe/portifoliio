/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — deployable on GitHub Pages, Vercel, or any static host.
  output: "export",
  images: { unoptimized: true },
  // The canvas engine mutates the DOM directly; StrictMode's double-mount in
  // dev would double-init listeners, so we guard in code and disable it here.
  reactStrictMode: false,
  // Hide the Next.js dev-tools badge ("N") in `npm run dev` — dev only anyway.
  devIndicators: false,
};

export default nextConfig;
