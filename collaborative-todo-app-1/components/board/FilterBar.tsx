/**
 * @fileoverview FilterBar Component
 *
 * This component provides client-side filter controls for the Kanban board.
 * It allows filtering by priority, assignee, tag, and due date.
 *
 * FEATURES:
 * - Priority filter (Low, Medium, High, Urgent)
 * - Assignee filter (board members)
 * - Tag filter (board tags)
 * - Due date filter (Overdue, Today, This Week)
 * - Clear all filters button
 * - Responsive: collapsible on mobile, inline on desktop
 *
 * DESIGN:
 * - All filters operate on already-loaded data (no extra API calls)
 * - Uses controlled state from parent KanbanBoard component
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
 */

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { X, SlidersHorizontal } from 'lucide-react'
import type { Tag } from '@/lib/generated/prisma/browser'

interface FilterBarProps {
  members: { id: string; name: string; image: string | null }[]
  tags: Tag[]
  filters: {
    priority: string[]
    assignee: string[]
    tag: string[]
    dueDate: string | null
  }
  onFiltersChange: (filters: {
    priority: string[]
    assignee: string[]
    tag: string[]
    dueDate: string | null
  }) => void
}

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const DUE_DATE_OPTIONS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
]

/**
 * Shared filter controls — dropdowns, active badges, and clear button.
 * Rendered by both mobile (collapsible) and desktop (inline) layouts.
 */
function FilterControls({
  members,
  tags,
  filters,
  onFiltersChange,
  hasActiveFilters,
  toggleFilter,
  setDueDateFilter,
  clearAllFilters,
}: FilterBarProps & {
  hasActiveFilters: boolean
  toggleFilter: (filterType: 'priority' | 'assignee' | 'tag', value: string) => void
  setDueDateFilter: (value: string | null) => void
  clearAllFilters: () => void
}) {
  return (
    <>
      {/* Priority filter */}
      <Select
        value={filters.priority[0] || ''}
        onValueChange={(value) => {
          if (value) {
            onFiltersChange({
              ...filters,
              priority: filters.priority.includes(value)
                ? filters.priority.filter((v) => v !== value)
                : [...filters.priority, value],
            })
          }
        }}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select
        value={filters.assignee[0] || ''}
        onValueChange={(value) => {
          if (value) {
            onFiltersChange({
              ...filters,
              assignee: filters.assignee.includes(value)
                ? filters.assignee.filter((v) => v !== value)
                : [...filters.assignee, value],
            })
          }
        }}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tag filter */}
      <Select
        value={filters.tag[0] || ''}
        onValueChange={(value) => {
          if (value) {
            onFiltersChange({
              ...filters,
              tag: filters.tag.includes(value)
                ? filters.tag.filter((v) => v !== value)
                : [...filters.tag, value],
            })
          }
        }}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Due date filter */}
      <Select
        value={filters.dueDate || ''}
        onValueChange={(value) => setDueDateFilter(value || null)}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Due date" />
        </SelectTrigger>
        <SelectContent>
          {DUE_DATE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <>
          <div className="h-4 w-px bg-border" />

          {filters.priority.map((p) => (
            <Badge
              key={`priority-${p}`}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {PRIORITIES.find((pr) => pr.value === p)?.label}
              <button
                onClick={() => toggleFilter('priority', p)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {filters.assignee.map((a) => (
            <Badge
              key={`assignee-${a}`}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {members.find((m) => m.id === a)?.name}
              <button
                onClick={() => toggleFilter('assignee', a)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {filters.tag.map((t) => (
            <Badge
              key={`tag-${t}`}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {tags.find((tag) => tag.id === t)?.name}
              <button
                onClick={() => toggleFilter('tag', t)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {filters.dueDate && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {DUE_DATE_OPTIONS.find((opt) => opt.value === filters.dueDate)?.label}
              <button
                onClick={() => setDueDateFilter(null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        </>
      )}
    </>
  )
}

/**
 * FilterBar — renders filter controls for the Kanban board
 *
 * WHAT IT DOES:
 * 1. Renders filter dropdowns for priority, assignee, tag, and due date
 * 2. Shows active filters as badges
 * 3. Provides a "Clear all" button when filters are active
 * 4. On mobile: renders as a collapsible toggle
 * 5. On desktop: renders as an inline horizontal bar
 *
 * @param members - Board members for assignee filter
 * @param tags - Board tags for tag filter
 * @param filters - Current filter state
 * @param onFiltersChange - Callback to update filters
 */
export function FilterBar({
  members,
  tags,
  filters,
  onFiltersChange,
}: FilterBarProps) {
  const isMobile = useIsMobile()
  const [isExpanded, setIsExpanded] = useState(false)

  const hasActiveFilters =
    filters.priority.length > 0 ||
    filters.assignee.length > 0 ||
    filters.tag.length > 0 ||
    filters.dueDate !== null

  function toggleFilter(
    filterType: 'priority' | 'assignee' | 'tag',
    value: string
  ) {
    onFiltersChange({
      ...filters,
      [filterType]: filters[filterType].includes(value)
        ? filters[filterType].filter((v) => v !== value)
        : [...filters[filterType], value],
    })
  }

  function setDueDateFilter(value: string | null) {
    onFiltersChange({
      ...filters,
      dueDate: value,
    })
  }

  function clearAllFilters() {
    onFiltersChange({
      priority: [],
      assignee: [],
      tag: [],
      dueDate: null,
    })
  }

  const sharedProps = {
    members,
    tags,
    filters,
    onFiltersChange,
    hasActiveFilters,
    toggleFilter,
    setDueDateFilter,
    clearAllFilters,
  }

  return (
    <div className="mb-4">
      {isMobile ? (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full px-1 py-1"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {filters.priority.length + filters.assignee.length + filters.tag.length + (filters.dueDate ? 1 : 0)} active
              </Badge>
            )}
          </button>
          {isExpanded && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <FilterControls {...sharedProps} />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <FilterControls {...sharedProps} />
        </div>
      )}
    </div>
  )
}
