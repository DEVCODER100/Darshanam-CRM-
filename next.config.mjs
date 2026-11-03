/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs reads .xlsx through jszip, which breaks when bundled; load it as plain Node code.
  experimental: { serverComponentsExternalPackages: ["exceljs", "jszip"] },
};

export default nextConfig;
