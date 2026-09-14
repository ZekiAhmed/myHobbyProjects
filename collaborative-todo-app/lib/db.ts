// WHY A SINGLETON?
// In Next.js dev mode, files get hot-reloaded constantly. If we naively did
// `export const db = new PrismaClient()` at the top of this file, every hot
// reload would create a BRAND NEW PrismaClient — and each one opens its own
// pool of database connections. After enough reloads you'd exhaust your
// database's max connections and everything would start failing.
//
// The fix: stash the client on the Node.js `global` object, which SURVIVES
// hot reloads (unlike module-level variables, which get re-initialized).
// In production this trick is a no-op (there's no hot reloading), but it's
// harmless to leave in.

// import { PrismaClient } from '@prisma/client'

// // TypeScript doesn't know about our custom property on `global` by default,
// // so we cast it to a type that does.
// const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// export const db =
//   globalForPrisma.prisma ??
//   new PrismaClient({
//     // Verbose logging locally (great for debugging slow queries), but only
//     // log actual errors in production (verbose logs would be noisy + slow).
//     log: process.env.NODE_ENV === 'development'
//       ? ['query', 'error', 'warn']
//       : ['error'],
//   })

// if (process.env.NODE_ENV !== 'production') {
//   globalForPrisma.prisma = db
// }

//==============================================================

// import "dotenv/config";
// import { PrismaClient } from "../lib/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// const globalForPrisma = global as unknown as {
//   prisma: PrismaClient;
// };
// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL,
// });
// const prisma =
//   globalForPrisma.prisma ||
//   new PrismaClient({
//     adapter,
//   });
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
// // export default prisma;
// export {prisma}

//==========================================================

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10, // max connections in pool
  min: 2, // keep 2 connections alive at all times (prevents cold start)
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
