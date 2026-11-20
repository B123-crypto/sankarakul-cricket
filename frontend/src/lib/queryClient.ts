export const matchQueryKeys = {
  lists: ['matches'] as const,
  list: (status: string) => ['matches', status] as const,
  detail: (matchId: string) => ['match', matchId] as const,
}
