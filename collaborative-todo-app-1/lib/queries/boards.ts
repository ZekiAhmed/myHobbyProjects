import { queryOptions } from '@tanstack/react-query'

export const boardKeys = {
  all:    ()           => ['boards']               as const,
  detail: (id: string) => ['boards', id]           as const,
  todos:  (id: string) => ['boards', id, 'todos']  as const,
}

export const boardsQueryOptions = () =>
  queryOptions({
    queryKey:  boardKeys.all(),
    queryFn:   () => fetch('/api/boards').then(r => r.json()),
    staleTime: 30_000,
    gcTime:    300_000,
  })

export const boardDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey:  boardKeys.detail(id),
    queryFn:   () => fetch(`/api/boards/${id}`).then(r => r.json()),
    staleTime: 30_000,
    gcTime:    300_000,
  })

export const todosQueryOptions = (id: string) =>
  queryOptions({
    queryKey:        boardKeys.todos(id),
    queryFn:         () => fetch(`/api/boards/${id}/todos`).then(r => r.json()),
    staleTime:       0,
    gcTime:          300_000,
    refetchInterval: 8_000,
    retry:           3,
  })
