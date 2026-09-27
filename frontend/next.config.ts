import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.BUILD_TARGET === "electron" ? { output: "standalone" as const } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
