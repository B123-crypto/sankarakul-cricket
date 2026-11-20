import { useQuery } from '@tanstack/react-query'
import { ArrowRight, LogOut, Plus, Shield, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { useAuth } from '../features/auth/useAuth'
import { getApiData, getApiErrorMessage } from '../lib/api'
import { matchQueryKeys } from '../lib/queryClient'
import type { MatchSummary } from '../types/match'

export function DirectorDashboardPage() {
  const { director, logout } = useAuth()
  const matchesQuery = useQuery({
    queryKey: matchQueryKeys.list('all'),
    queryFn: () => getApiData<MatchSummary[]>('/matches'),
  })
  const liveMatches = matchesQuery.data?.filter((match) => match.status === 'live') ?? []
  const scheduledMatches = matchesQuery.data?.filter((match) => match.status === 'scheduled') ?? []

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-forest">DIRECTOR DESK</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Welcome, {director?.name ?? 'Director'}</h1>
            <p className="mt-1 text-sm text-ink/55">{director?.email}</p>
          </div>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-ink/65 hover:text-red-700" onClick={logout} type="button">
            <LogOut size={15} /> Sign out
          </button>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Link className="flex min-h-28 items-center justify-between rounded-2xl bg-lime p-5 transition hover:brightness-95" to="/director/matches/new">
            <div><Plus size={19} /><strong className="mt-3 block font-display text-lg">Create a match</strong><span className="text-xs text-ink/65">Set teams, overs, and venue</span></div>
            <ArrowRight size={18} />
          </Link>
          <Link className="flex min-h-28 items-center justify-between rounded-2xl bg-white p-5 ring-1 ring-black/10 transition hover:ring-forest/30" to="/director/teams">
            <div><Users size={19} className="text-forest" /><strong className="mt-3 block font-display text-lg">Manage teams</strong><span className="text-xs text-ink/55">Players and team details</span></div>
            <ArrowRight size={18} className="text-ink/45" />
          </Link>
          <div className="flex min-h-28 items-center gap-4 rounded-2xl bg-forest p-5 text-white">
            <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-lime"><Shield size={20} /></span>
            <div><strong className="font-display text-lg">Director only</strong><span className="mt-1 block text-xs text-white/55">You control match scoring</span></div>
          </div>
        </div>

        {matchesQuery.isError ? (
          <p className="mt-7 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{getApiErrorMessage(matchesQuery.error)}</p>
        ) : (
          <>
            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between">
                <div><p className="font-mono text-[10px] tracking-[0.16em] text-forest">IN PLAY</p><h2 className="mt-1 font-display text-2xl font-semibold">Live matches</h2></div>
                <span className="font-mono text-xs text-ink/45">{liveMatches.length} LIVE</span>
              </div>
              {matchesQuery.isPending ? (
                <p className="rounded-xl bg-white p-5 text-sm text-ink/55">Loading matches…</p>
              ) : liveMatches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/15 bg-white/70 p-5 text-sm text-ink/55">No live matches. Start a scheduled match when your teams are ready.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {liveMatches.map((match) => (
                    <Link className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/10 hover:ring-forest/30" key={match.id} to={`/director/matches/${match.id}`}>
                      <div><span className="font-mono text-[10px] font-bold tracking-wider text-red-700">LIVE · {match.format}</span><strong className="mt-2 block">{match.home_team_short_name} vs {match.away_team_short_name}</strong></div>
                      <span className="text-right"><strong className="font-display text-xl">{match.current_total_runs ?? 0}/{match.current_wickets ?? 0}</strong><span className="mt-1 block text-xs text-ink/50">{match.current_legal_balls ?? 0} legal balls</span></span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-9">
              <div className="mb-4 flex items-end justify-between">
                <div><p className="font-mono text-[10px] tracking-[0.16em] text-forest">UP NEXT</p><h2 className="mt-1 font-display text-2xl font-semibold">Scheduled</h2></div>
                <Link className="text-sm font-bold text-forest hover:underline" to="/director/matches/new">New match</Link>
              </div>
              {scheduledMatches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/15 bg-white/70 p-5 text-sm text-ink/55">No upcoming matches. Create one to get the tournament started.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {scheduledMatches.map((match) => (
                    <Link className="flex items-center justify-between rounded-2xl bg-white p-5 ring-1 ring-black/10 hover:ring-forest/30" key={match.id} to={`/director/matches/${match.id}`}>
                      <div><strong>{match.home_team_name} <span className="text-ink/40">vs</span> {match.away_team_name}</strong><span className="mt-1 block text-xs text-ink/50">{match.format} · {match.overs_per_innings} overs</span></div>
                      <ArrowRight size={17} className="text-ink/45" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </SiteLayout>
  )
}
