// A trivial uptime-monitoring endpoint (e.g. for a status page or
// deployment health check). Deliberately requires NO authentication —
// monitoring tools shouldn't need credentials just to ask "is the database
// reachable?" It does the absolute minimum query possible (`SELECT 1`) so
// it doesn't itself become a source of load.

import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    // If Postgres (or Prisma Accelerate) is unreachable, report 503 so
    // uptime monitors correctly flag this as a real outage.
    return NextResponse.json({ status: 'db_unreachable' }, { status: 503 })
  }
}