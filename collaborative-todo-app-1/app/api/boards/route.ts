import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'

export async function GET() {
  const session = await getRequiredSession()
  
  const boards = await prisma.board.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          members: true,
          todos: {
            where: {
              status: {
                not: 'DONE',
              },
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
  
  return NextResponse.json(boards)
}
