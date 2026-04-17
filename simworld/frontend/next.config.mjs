/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
};

// Static export only for desktop (Tauri) builds
if (process.env.STATIC_EXPORT === "true") {
  nextConfig.output = "export";
}

export default nextConfig;
