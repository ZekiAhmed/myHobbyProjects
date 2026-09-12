// PRD feature #22: filter the (already-loaded) board by priority,
// assignee, tag, or due date. This component is intentionally "dumb" — it
// just reports the selected filter values up to KanbanBoard via onChange;
// KanbanBoard is what actually applies the filtering logic to the todos
// array (see its `filteredTodos` useMemo).

// 'use client'

// import { Select } from '@/components/ui'
// import type { Priority } from '@/lib/generated/prisma/client'

// type Member = { id: string; name: string }
// type TagOption = { id: string; name: string }

// type Filters = {
//   priority?: Priority
//   assigneeId?: string
//   tagId?: string
// }

// type FilterBarProps = {
//   members: Member[]
//   tags: TagOption[]
//   filters: Filters
//   onChange: (filters: Filters) => void
// }

// export function FilterBar({ members, tags, filters, onChange }: FilterBarProps) {
//   return (
//     <div style={{ display: 'flex', gap: '0.5rem' }}>
//       <Select
//         label="Priority"
//         value={filters.priority ?? ''}
//         onChange={(e) =>
//           onChange({ ...filters, priority: (e.target.value || undefined) as Priority | undefined })
//         }
//       >
//         <option value="">All priorities</option>
//         <option value="LOW">Low</option>
//         <option value="MEDIUM">Medium</option>
//         <option value="HIGH">High</option>
//         <option value="URGENT">Urgent</option>
//       </Select>

//       <Select
//         label="Assignee"
//         value={filters.assigneeId ?? ''}
//         onChange={(e) => onChange({ ...filters, assigneeId: e.target.value || undefined })}
//       >
//         <option value="">All assignees</option>
//         {members.map((m) => (
//           <option key={m.id} value={m.id}>{m.name}</option>
//         ))}
//       </Select>

//       <Select
//         label="Tag"
//         value={filters.tagId ?? ''}
//         onChange={(e) => onChange({ ...filters, tagId: e.target.value || undefined })}
//       >
//         <option value="">All tags</option>
//         {tags.map((t) => (
//           <option key={t.id} value={t.id}>{t.name}</option>
//         ))}
//       </Select>

//       {(filters.priority || filters.assigneeId || filters.tagId) && (
//         <button onClick={() => onChange({})}>Clear filters</button>
//       )}
//     </div>
//   )
// }

//===============================================================================

"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority } from "@/lib/generated/prisma/client";

type Member = { id: string; name: string };
type TagOption = { id: string; name: string };

type Filters = {
  priority?: Priority;
  assigneeId?: string;
  tagId?: string;
};

type FilterBarProps = {
  members: Member[];
  tags: TagOption[];
  filters: Filters;
  onChange: (filters: Filters) => void;
};

const ALL_VALUE = "all";

export function FilterBar({
  members,
  tags,
  filters,
  onChange,
}: FilterBarProps) {
  const hasActiveFilters = Boolean(
    filters.priority || filters.assigneeId || filters.tagId,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Priority Filter */}
      <Select
        value={filters.priority ?? ALL_VALUE}
        onValueChange={(val) =>
          onChange({
            ...filters,
            priority: val === ALL_VALUE ? undefined : (val as Priority),
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
          <SelectItem value="URGENT">Urgent</SelectItem>
        </SelectContent>
      </Select>

      {/* Assignee Filter */}
      <Select
        value={filters.assigneeId ?? ALL_VALUE}
        onValueChange={(val) =>
          onChange({
            ...filters,
            assigneeId: val === ALL_VALUE ? undefined : (val ?? undefined),
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All assignees</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tag Filter */}
      <Select
        value={filters.tagId ?? ALL_VALUE}
        onValueChange={(val) =>
          onChange({
            ...filters,
            tagId: val === ALL_VALUE ? undefined : (val ?? undefined),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All tags</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button variant="ghost" onClick={() => onChange({})}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
