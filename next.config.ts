import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "exceljs", "pdf-lib"],
};

export default nextConfig;
