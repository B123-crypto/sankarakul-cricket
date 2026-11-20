import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  MapPin,
  RefreshCw,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { getApiData, getApiErrorMessage } from '../lib/api'
import { matchQueryKeys } from '../lib/queryClient'
import type { MatchStatus, MatchSummary } from '../types/match'

const filters: { label: string; value: MatchStatus | 'all' }[] = [
  { label: 'All matches', value: 'all' },
  { label: 'Live now', value: 'live' },
  { label: 'Upcoming', value: 'scheduled' },
  { label: 'Results', value: 'completed' },
]

const statusLabels: Record<MatchStatus, string> = {
  live: 'Live',
  scheduled: 'Upcoming',
  completed: 'Final',
  abandoned: 'Abandoned',
}

function formatOvers(legalBalls: number | null | undefined) {
  if (legalBalls == null) return 'Yet to start'
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6} overs`
}

function formatSchedule(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function MatchCard({ match }: { match: MatchSummary }) {
  const status = match.status in statusLabels
    ? statusLabels[match.status]
    : 'Match'
  const hasScore = match.current_total_runs != null
  const score = hasScore
    ? `${match.current_total_runs}/${match.current_wickets ?? 0}`
    : null
  const scheduled = formatSchedule(match.scheduled_at)
  const statusColor = match.status === 'live'
    ? 'bg-red-50 text-red-700'
    : match.status === 'completed'
      ? 'bg-ink/5 text-ink/60'
      : 'bg-lime/40 text-forest'

  return (
    <Link
      className="group block rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-xl hover:shadow-forest/5"
      to={`/matches/${match.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statusColor}`}>
          {match.status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-red-600" />}
          {status}
        </span>
        <span className="font-mono text-[10px] font-medium tracking-wider text-ink/45">
          {match.format} <span className="px-1">·</span> {match.overs_per_innings} OV
        </span>
      </div>

      <div className="my-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper font-display text-xs font-bold tracking-wider text-forest">
            {match.home_team_short_name.slice(0, 3)}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{match.home_team_name}</span>
          {hasScore && String(match.current_batting_team_id) === String(match.home_team_id) && (
            <strong className="font-display text-lg">{score}</strong>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper font-display text-xs font-bold tracking-wider text-forest">
            {match.away_team_short_name.slice(0, 3)}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{match.away_team_name}</span>
          {hasScore && String(match.current_batting_team_id) === String(match.away_team_id) && (
            <strong className="font-display text-lg">{score}</strong>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-black/5 pt-4">
        <div className="flex min-w-0 flex-col gap-2 text-xs text-ink/55">
          {match.status === 'live' && match.current_innings_number ? (
            <span>Innings {match.current_innings_number} · {formatOvers(match.current_legal_balls)}</span>
          ) : match.result_text ? (
            <span className="line-clamp-2 font-semibold text-forest">{match.result_text}</span>
          ) : scheduled ? (
            <span className="flex items-center gap-1.5"><CalendarDays size={13} />{scheduled}</span>
          ) : (
            <span>{match.status === 'scheduled' ? 'Ready to begin' : 'Scorecard available'}</span>
          )}
          {match.venue && <span className="flex items-center gap-1.5 truncate"><MapPin size={13} />{match.venue}</span>}
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-ink/60 transition group-hover:bg-lime group-hover:text-ink">
          <ArrowRight size={17} />
        </span>
      </div>
    </Link>
  )
}

export function MatchesPage() {
  const [activeFilter, setActiveFilter] = useState<MatchStatus | 'all'>('all')
  const status = activeFilter === 'all' ? undefined : activeFilter
  const matchesQuery = useQuery({
    queryKey: matchQueryKeys.list(activeFilter),
    queryFn: () =>
      getApiData<MatchSummary[]>(
        `/matches${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  })

  const matches = matchesQuery.data ?? []
  const liveCount = matches.filter((match) => match.status === 'live').length

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8">
        <section className="relative my-7 flex min-h-72 overflow-hidden rounded-3xl bg-forest px-6 py-9 text-white sm:my-10 sm:min-h-80 sm:px-12 sm:py-12">
          <div className="relative z-10 max-w-xl">
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-lime">
              <span className="h-px w-7 bg-lime" /> THE MATCH CENTRE
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Every over.<br /><span className="text-lime">Every moment.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65 sm:text-base">
              Follow the game as it happens. Scores, stories, and the moments that matter.
            </p>
            <div className="mt-7 flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-white/60">
              <Trophy size={14} className="text-lime" /> LOCAL TOURNAMENTS
              <span className="mx-2 h-3 w-px bg-white/20" />
              MADE FOR THE LOVE OF THE GAME
            </div>
          </div>
          <div className="pointer-events-none absolute -right-12 -top-14 hidden size-96 items-center justify-center sm:flex">
            <div className="absolute size-72 rounded-full border border-white/10" />
            <div className="absolute size-52 rounded-full border border-white/10" />
            <div className="absolute size-32 rounded-full bg-lime shadow-[0_0_80px_20px_rgba(203,243,106,0.22)]" />
            <div className="absolute right-8 top-28 rotate-12 font-display text-6xl font-bold text-white/10">01<span className="text-2xl">/06</span></div>
            <div className="absolute bottom-10 right-20 font-mono text-[10px] font-bold tracking-[0.2em] text-white/45">THE GAME IS ON</div>
          </div>
          <div className="absolute bottom-0 right-0 h-1 w-full bg-lime/80 sm:w-1/3" />
        </section>

        <section aria-labelledby="matches-title">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] font-medium tracking-[0.18em] text-forest">ON THE BOUNDARY</div>
              <h2 id="matches-title" className="mt-1 font-display text-3xl font-semibold tracking-tight">Matches</h2>
            </div>
            <button
              className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-ink/60 transition hover:border-forest/30 hover:text-forest disabled:opacity-50"
              type="button"
              onClick={() => void matchesQuery.refetch()}
              disabled={matchesQuery.isFetching}
              aria-label="Refresh matches"
              title="Refresh matches"
            >
              <RefreshCw size={16} className={matchesQuery.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter matches">
            {filters.map((filter) => (
              <button
                key={filter.value}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${
                  activeFilter === filter.value
                    ? 'border-ink bg-ink text-white'
                    : 'border-black/10 bg-white text-ink/65 hover:border-ink/30'
                }`}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.value}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.value === 'live' && <span className={`size-1.5 rounded-full ${activeFilter === filter.value ? 'bg-lime' : 'bg-red-500'}`} />}
                {filter.label}
                {filter.value === 'live' && liveCount > 0 && (
                  <span className={`grid size-5 place-items-center rounded-full text-[10px] ${activeFilter === filter.value ? 'bg-white/15' : 'bg-red-50 text-red-700'}`}>{liveCount}</span>
                )}
              </button>
            ))}
            <span className="ml-auto hidden font-mono text-[10px] tracking-wider text-ink/40 sm:inline">
              {matchesQuery.isSuccess ? `${matches.length} ${matches.length === 1 ? 'MATCH' : 'MATCHES'}` : ''}
            </span>
          </div>

          {matchesQuery.isPending ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white text-center" role="status">
              <span className="size-8 animate-spin rounded-full border-2 border-forest/15 border-t-forest" />
              <strong className="font-display">Finding the game</strong>
              <span className="text-sm text-ink/55">Loading matches from the score server…</span>
            </div>
          ) : matchesQuery.isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white px-6 text-center" role="alert">
              <CircleAlert className="text-red-600" size={24} />
              <strong className="font-display text-lg">Couldn’t load the matches</strong>
              <span className="max-w-lg text-sm leading-6 text-ink/60">{getApiErrorMessage(matchesQuery.error)}</span>
              <button className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest" type="button" onClick={() => void matchesQuery.refetch()}>
                Try again <RefreshCw size={14} />
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 text-center">
              <Activity className="text-forest/50" size={24} />
              <strong className="font-display text-lg">No matches here. Yet.</strong>
              <span className="max-w-sm text-sm leading-6 text-ink/55">
                {activeFilter === 'live'
                  ? 'When a match goes live, you’ll find it here.'
                  : activeFilter === 'scheduled'
                    ? 'There are no upcoming matches right now.'
                    : activeFilter === 'completed'
                      ? 'Completed scorecards will show up here.'
                      : 'Matches will appear here as soon as the tournament is set up.'}
              </span>
              {activeFilter !== 'all' && (
                <button className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline" type="button" onClick={() => setActiveFilter('all')}>
                  View all matches <ArrowDown size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {matches.map((match) => <MatchCard key={match.id} match={match} />)}
            </div>
          )}
        </section>
      </main>
    </SiteLayout>
  )
}
