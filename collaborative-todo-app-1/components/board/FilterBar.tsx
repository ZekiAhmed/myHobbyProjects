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
 *
 * DESIGN:
 * - All filters operate on already-loaded data (no extra API calls)
 * - Uses controlled state from parent KanbanBoard component
 * - Responsive layout with horizontal scroll on mobile
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
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
 * FilterBar — renders filter controls for the Kanban board
 *
 * WHAT IT DOES:
 * 1. Renders filter dropdowns for priority, assignee, tag, and due date
 * 2. Shows active filters as badges
 * 3. Provides a "Clear all" button when filters are active
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
  // Check if any filters are active
  const hasActiveFilters =
    filters.priority.length > 0 ||
    filters.assignee.length > 0 ||
    filters.tag.length > 0 ||
    filters.dueDate !== null

  /**
   * Toggle a value in a multi-select filter
   */
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

  /**
   * Set the due date filter
   */
  function setDueDateFilter(value: string | null) {
    onFiltersChange({
      ...filters,
      dueDate: value,
    })
  }

  /**
   * Clear all filters
   */
  function clearAllFilters() {
    onFiltersChange({
      priority: [],
      assignee: [],
      tag: [],
      dueDate: null,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
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
          
          {/* Priority badges */}
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

          {/* Assignee badges */}
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

          {/* Tag badges */}
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

          {/* Due date badge */}
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

          {/* Clear all button */}
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
    </div>
  )
}
