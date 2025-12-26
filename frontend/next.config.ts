import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude problematic packages from server-side bundling
  // This fixes the pino/thread-stream test file bundling issue
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  
  // Empty turbopack config to silence the webpack warning
  turbopack: {},
};

export default nextConfig;
