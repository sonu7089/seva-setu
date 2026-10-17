/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output keeps the Docker / DigitalOcean App Platform image
  // small: only server.js + traced node_modules are shipped.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
