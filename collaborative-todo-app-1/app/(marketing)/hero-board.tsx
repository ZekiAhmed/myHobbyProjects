/**
 * Decorative hero board preview (Client Component).
 *
 * A synthetic three-column board that dramatizes the product's real
 * sync loop: the mono readout counts the product's actual 8-second
 * refetch cadence, and demo cards glide between columns on each tick
 * to show what teammates' moves look like. aria-hidden — it repeats
 * the headline's meaning; the marketing page itself never polls.
 *
 * Reduced motion: static readout, no glides (interval never starts).
 */

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type Col = 'todo' | 'progress' | 'done'
type CardId = 'launch' | 'pricing' | 'invite' | 'notes' | 'setup'
type Badge = 'urgent' | 'tag' | 'done' | null

const TICK_MS = 8_000

const CARDS: Record<
  CardId,
  { title: string; badge: Badge; ticket: string }
> = {
  launch: { title: 'Draft launch checklist', badge: 'urgent', ticket: 'SN · Tue' },
  pricing: { title: 'Review pricing copy', badge: null, ticket: 'MK · Wed' },
  invite: { title: 'Ship invite flow', badge: 'tag', ticket: 'HT · Fri' },
  notes: { title: 'Write release notes', badge: null, ticket: 'GM · Thu' },
  setup: { title: 'Set up the board', badge: 'done', ticket: 'AB · Mon' },
}

const COLUMNS: { id: Col; title: string; order: CardId[] }[] = [
  { id: 'todo', title: 'To Do', order: ['launch', 'pricing'] },
  { id: 'progress', title: 'In Progress', order: ['invite', 'notes'] },
  { id: 'done', title: 'Done', order: ['setup'] },
]

/** Card home columns; phase advances one glide per 8s tick. */
const HOME: Record<CardId, Col> = {
  launch: 'todo',
  pricing: 'todo',
  invite: 'progress',
  notes: 'progress',
  setup: 'done',
}

function positions(phase: number): Record<CardId, Col> {
  const pos = { ...HOME }
  if (phase >= 1) pos.invite = 'done'
  if (phase >= 2) pos.launch = 'progress'
  return pos
}

function BoardCard({
  id,
  register,
}: {
  id: CardId
  register: (id: CardId, el: HTMLElement | null) => void
}) {
  const card = CARDS[id]
  return (
    <div
      ref={(el) => register(id, el)}
      className="rounded-md border border-[rgb(244_244_245_/_0.1)] bg-[var(--board-card)] p-2 md:p-2.5"
    >
      <p className="text-[11px] leading-tight font-medium text-foreground md:text-xs">
        {card.title}
      </p>
      {card.badge === 'urgent' && (
        <span className="mono mt-1.5 inline-block rounded-full bg-destructive/15 px-1.5 py-px text-[9px] font-medium text-red-400 md:text-[10px]">
          Urgent
        </span>
      )}
      {card.badge === 'tag' && (
        <span className="mono mt-1.5 inline-block rounded border border-[rgb(244_244_245_/_0.12)] bg-white/[0.04] px-1.5 py-px text-[9px] font-medium text-muted-foreground md:text-[10px]">
          feature
        </span>
      )}
      {card.badge === 'done' && (
        <span className="mono mt-1.5 inline-flex items-center gap-1 text-[9px] font-medium text-[var(--status-done)] md:text-[10px]">
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-2.5"
            aria-hidden="true"
          >
            <path d="m2.5 6.2 2.4 2.4 4.6-5" />
          </svg>
          Done
        </span>
      )}
      <p className="mono mt-1.5 text-[9px] text-zinc-400 md:text-[10px]">
        {card.ticket}
      </p>
    </div>
  )
}

export function HeroBoard() {
  const [t, setT] = useState(0)
  const reducedRef = useRef(false)
  const cardEls = useRef(new Map<CardId, HTMLElement>())
  const prevRects = useRef<Record<string, DOMRect> | null>(null)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      reducedRef.current = true
      return
    }
    // Pause in background tabs: throttled ticks would desync the readout.
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (id === null) id = setInterval(() => setT((x) => x + 1), 1000)
    }
    const stop = () => {
      if (id !== null) {
        clearInterval(id)
        id = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const ticksPerPhase = TICK_MS / 1000
  const phase = Math.floor(t / ticksPerPhase) % 3
  const sec = t % ticksPerPhase === 0 ? 8 : 8 - (t % ticksPerPhase)

  // FLIP: glide cards between columns on every phase change.
  useLayoutEffect(() => {
    const next: Record<string, DOMRect> = {}
    cardEls.current.forEach((el, id) => {
      if (el) next[id] = el.getBoundingClientRect()
    })
    const prev = prevRects.current
    prevRects.current = next
    if (!prev || reducedRef.current) return
    cardEls.current.forEach((el, id) => {
      const before = prev[id]
      const after = next[id]
      if (!el || !before || !after) return
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ],
        { duration: 640, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    })
  }, [phase])

  const pos = positions(phase)

  return (
    <div
      aria-hidden="true"
      className="board-aura relative w-full rounded-xl p-4 md:p-6"
    >
      <div className="relative rounded-xl border border-[rgb(244_244_245_/_0.14)] bg-[var(--board-frame)]">
        {/* readout strip */}
        <div className="flex items-center justify-end gap-2 border-b border-[rgb(244_244_245_/_0.1)] px-3 py-2">
          <span className="mono text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
            Sync
          </span>
          <span
            key={Math.floor(t / (TICK_MS / 1000))}
            className="sync-dot size-1.5 rounded-full bg-[var(--glow)]"
          />
          <span className="mono text-[11px] tabular-nums text-[var(--glow)]">
            {String(sec).padStart(2, '0')}s
          </span>
        </div>

        {/* three columns */}
        <div className="grid grid-cols-3 gap-1.5 p-2 md:gap-3 md:p-3">
          {COLUMNS.map((column) => {
            const members = [
              ...column.order.filter((id) => pos[id] === column.id),
              ...Object.keys(pos).filter(
                (id) =>
                  pos[id as CardId] === column.id &&
                  !column.order.includes(id as CardId),
              ) as CardId[],
            ]
            return (
              <div
                key={column.id}
                className="rounded-lg border border-[rgb(244_244_245_/_0.1)] bg-[var(--board-column)] p-1.5 md:p-2"
              >
                <div className="mb-1.5 flex h-12 flex-col items-start justify-between gap-1 px-1 md:mb-2 md:h-auto md:flex-row md:items-center">
                  <span className="mono text-[9px] font-medium tracking-[0.1em] text-zinc-400 uppercase md:text-[10px]">
                    {column.title}
                  </span>
                  <span className="mono rounded-full border border-[rgb(244_244_245_/_0.12)] bg-white/[0.03] px-1.5 text-[9px] tabular-nums text-zinc-400 md:text-[10px]">
                    {members.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 md:gap-2">
                  {members.map((id) => (
                    <BoardCard
                      key={id}
                      id={id}
                      register={(cardId, el) => {
                        if (el) cardEls.current.set(cardId, el)
                        else cardEls.current.delete(cardId)
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
