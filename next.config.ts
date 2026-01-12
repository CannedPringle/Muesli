import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for better-sqlite3 native module
  serverExternalPackages: ['better-sqlite3'],
  
  // Disable static optimization for pages that use SQLite
  // This ensures the database is accessed at runtime, not build time
  experimental: {
    // Allow server actions
  },
};

export default nextConfig;
