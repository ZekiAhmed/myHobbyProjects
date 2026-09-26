// next.config.ts
import type { NextConfig } from "next";

// serverExternalPackages tells Next.js NOT to bundle these packages through
// Turbopack/webpack — they're used as-is via Node's native require/import.
// This is the documented workaround for Turbopack struggling to resolve a
// Prisma client generated outside node_modules (lib/generated/prisma) plus
// the native `pg` driver used by @prisma/adapter-pg.
const nextConfig: NextConfig = {
  // serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    // Enables forbidden()/unauthorized() auth interrupts — the admin area's
    // requireAdmin gate throws forbidden() to answer 403 with a boundary.
    authInterrupts: true,
  },
};

export default nextConfig;
