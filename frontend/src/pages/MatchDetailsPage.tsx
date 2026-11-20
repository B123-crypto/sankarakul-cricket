import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  Target,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { getApiData, getApiErrorMessage } from '../lib/api'
import { matchQueryKeys } from '../lib/queryClient'
import { createMatchSocket } from '../lib/socket'
import type { MatchDetails, MatchInnings, MatchSummary } from '../types/match'

function formatOvers(legalBalls: number) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function InningsScorecard({ inning }: { inning: MatchInnings }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-black/5 p-5 sm:p-6">
        <div>
          <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-forest">INNINGS {inning.innings_number}</span>
          <h2 className="mt-1 font-display text-xl font-semibold">{inning.batting_team_name}</h2>
        </div>
        <div className="text-right">
          <strong className="font-display text-2xl font-semibold">{inning.total_runs}/{inning.wickets}</strong>
          <span className="mt-0.5 block font-mono text-[11px] text-ink/50">{formatOvers(inning.legal_balls)} overs</span>
        </div>
      </div>

      {inning.target_runs != null && (
        <div className="flex items-center gap-2 border-b border-black/5 bg-lime/20 px-5 py-2.5 text-xs font-semibold text-forest">
          <Target size={14} /> Target {inning.target_runs}
        </div>
      )}

      {(inning.current_striker_name || inning.current_bowler_name) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-black/5 px-5 py-3 text-[11px] text-ink/55">
          {inning.current_striker_name && (
            <span className="flex items-center gap-2">
              <i className="size-1.5 rounded-full bg-lime-600" />
              BATTING <strong className="text-ink">{inning.current_striker_name}{inning.current_non_striker_name ? ` · ${inning.current_non_striker_name}` : ''}</strong>
            </span>
          )}
          {inning.current_bowler_name && (
            <span>BOWLING <strong className="text-ink">{inning.current_bowler_name}</strong></span>
          )}
        </div>
      )}

      {inning.batting.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead className="bg-paper/70 font-mono text-[10px] tracking-wider text-ink/50">
              <tr><th className="px-5 py-3 font-medium">BATTER</th><th className="px-3 py-3 font-medium">R</th><th className="px-3 py-3 font-medium">B</th><th className="px-3 py-3 font-medium">4s</th><th className="px-3 py-3 font-medium">6s</th><th className="px-5 py-3 text-right font-medium">SR</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {inning.batting.map((batter) => (
                <tr key={batter.player_id}>
                  <td className="px-5 py-3 font-semibold">{batter.player_name}<small className="mt-0.5 block font-normal text-ink/45">{batter.is_out ? 'Out' : 'Not out'}</small></td>
                  <td className="px-3 py-3 font-bold">{batter.runs}</td>
                  <td className="px-3 py-3 text-ink/60">{batter.balls_faced}</td>
                  <td className="px-3 py-3 text-ink/60">{batter.fours}</td>
                  <td className="px-3 py-3 text-ink/60">{batter.sixes}</td>
                  <td className="px-5 py-3 text-right text-ink/60">{batter.strike_rate == null ? '—' : Number(batter.strike_rate).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inning.bowling.length > 0 && (
        <div className="overflow-x-auto border-t border-black/5">
          <table className="w-full min-w-[380px] text-left text-xs">
            <thead className="bg-paper/70 font-mono text-[10px] tracking-wider text-ink/50">
              <tr><th className="px-5 py-3 font-medium">BOWLER</th><th className="px-3 py-3 font-medium">O</th><th className="px-3 py-3 font-medium">R</th><th className="px-3 py-3 font-medium">W</th><th className="px-5 py-3 text-right font-medium">ECO</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {inning.bowling.map((bowler) => (
                <tr key={bowler.player_id}>
                  <td className="px-5 py-3 font-semibold">{bowler.player_name}</td>
                  <td className="px-3 py-3 text-ink/60">{formatOvers(bowler.legal_balls)}</td>
                  <td className="px-3 py-3 text-ink/60">{bowler.runs_conceded}</td>
                  <td className="px-3 py-3 font-bold">{bowler.wickets}</td>
                  <td className="px-5 py-3 text-right text-ink/60">{bowler.economy == null ? '—' : Number(bowler.economy).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/5 px-5 py-3 text-[10px] uppercase text-ink/50">
        <span className="font-mono font-medium tracking-wider">EXTRAS</span>
        {inning.extras.length === 0
          ? <strong className="text-ink">0</strong>
          : inning.extras.map((extra) => (
            <strong className="font-semibold text-ink" key={extra.extras_type}>{extra.extras_type.replace('_', ' ')} {extra.runs}</strong>
          ))}
      </div>
    </section>
  )
}

function RecentBalls({ inning }: { inning: MatchInnings }) {
  if (inning.deliveries.length === 0) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/5 p-5">
        <div>
          <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-forest">BALL BY BALL</span>
          <h2 className="mt-1 font-display text-lg font-semibold">Recent deliveries</h2>
        </div>
        <span className="font-mono text-[9px] tracking-wider text-ink/40">{inning.deliveries.length} SHOWN</span>
      </div>
      <div className="divide-y divide-black/5">
        {[...inning.deliveries].reverse().map((delivery) => {
          const label = delivery.wicket_type
            ? 'WICKET'
            : delivery.wide_runs
              ? `WIDE +${delivery.total_runs}`
              : delivery.no_ball_runs
                ? `NO BALL +${delivery.total_runs}`
                : delivery.total_runs === 0
                  ? 'DOT'
                  : `+${delivery.total_runs}`
          const resultStyle = delivery.wicket_type
            ? 'bg-red-50 text-red-700'
            : delivery.is_boundary
              ? 'bg-lime/40 text-forest'
              : 'bg-paper text-ink/70'
          return (
            <div className="flex items-center gap-3 px-5 py-3" key={delivery.delivery_number}>
              <span className="w-6 shrink-0 font-mono text-[10px] text-ink/40">{delivery.delivery_number}</span>
              <span className={`shrink-0 rounded px-2 py-1 font-mono text-[9px] font-bold tracking-wider ${resultStyle}`}>{label}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink/60">
                {delivery.wicket_type
                  ? `${delivery.dismissed_player_name ?? 'Batter'} dismissed · ${delivery.wicket_type.replaceAll('_', ' ')}`
                  : `${delivery.bowler_name} to ${delivery.striker_name}`}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MatchHeader({ match, socketConnected }: { match: MatchSummary; socketConnected: boolean }) {
  const live = match.status === 'live'
  const scheduled = formatDate(match.scheduled_at)
  const statusColor = live
    ? 'bg-red-50 text-red-700'
    : match.status === 'completed'
      ? 'bg-white/10 text-white/70'
      : 'bg-lime/20 text-lime'

  return (
    <section className="overflow-hidden rounded-3xl bg-forest text-white">
      <div className="border-b border-white/10 px-5 py-5 sm:px-9 sm:py-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider ${statusColor}`}>
            {live && <i className="size-1.5 animate-pulse rounded-full bg-red-600" />}
            {match.status.toUpperCase()}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-white/55">{match.format} · {match.overs_per_innings} OVERS</span>
          {live && (
            <span className={`ml-auto inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider ${socketConnected ? 'text-lime' : 'text-white/45'}`}>
              <Radio size={12} /> {socketConnected ? 'LIVE UPDATES ON' : 'RECONNECTING'}
            </span>
          )}
        </div>

        <div className="my-7 flex items-center justify-between gap-3 sm:my-10 sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 font-display text-sm font-bold tracking-wider text-lime sm:size-16">{match.home_team_short_name.slice(0, 3)}</span>
            <span className="text-base font-semibold leading-tight sm:text-xl">{match.home_team_name}</span>
          </div>
          <span className="font-mono text-[10px] font-medium tracking-widest text-white/40">VS</span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:flex-row-reverse sm:text-right">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 font-display text-sm font-bold tracking-wider text-lime sm:size-16">{match.away_team_short_name.slice(0, 3)}</span>
            <span className="text-base font-semibold leading-tight sm:text-xl">{match.away_team_name}</span>
          </div>
        </div>

        {match.result_text ? (
          <p className="text-center font-display text-lg font-semibold text-lime sm:text-xl">{match.result_text}</p>
        ) : live && match.current_total_runs != null ? (
          <div className="text-center">
            <strong className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">{match.current_total_runs}<span className="text-white/45">/{match.current_wickets ?? 0}</span></strong>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] tracking-wider text-white/55">
              <span>INNINGS {match.current_innings_number}</span>
              <i className="size-1 rounded-full bg-white/40" />
              <span>{formatOvers(match.current_legal_balls ?? 0)} OVERS</span>
              {match.current_target_runs != null && <span className="text-lime">TARGET {match.current_target_runs}</span>}
            </div>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-white/70">
            {scheduled ? <><Clock3 size={15} />{scheduled}</> : 'Match scorecard'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[10px] font-medium tracking-wider text-white/50 sm:px-9">
        {match.venue && <span className="flex items-center gap-1.5"><MapPin size={13} />{match.venue}</span>}
        <span className="ml-auto">UP TO {match.overs_per_innings} OVERS PER INNINGS</span>
      </div>
    </section>
  )
}

export function MatchDetailsPage() {
  const { matchId = '' } = useParams()
  const queryClient = useQueryClient()
  const [connectedMatchId, setConnectedMatchId] = useState<string | null>(null)
  const validMatchId = /^\d+$/.test(matchId)
  const queryKey = matchQueryKeys.detail(matchId)
  const matchQuery = useQuery({
    queryKey,
    queryFn: () => getApiData<MatchDetails>(`/matches/${encodeURIComponent(matchId)}`),
    enabled: validMatchId,
    refetchInterval: (query) =>
      query.state.data?.status === 'live' && connectedMatchId !== matchId ? 20_000 : false,
  })
  const matchStatus = matchQuery.data?.status

  useEffect(() => {
    if (matchStatus !== 'live') return

    const socket = createMatchSocket()
    const detailKey = matchQueryKeys.detail(matchId)
    const joinMatch = () => {
      socket.emit('match:join', matchId, (result: { success: boolean }) => {
        setConnectedMatchId(result.success ? matchId : null)
        if (result.success) void queryClient.invalidateQueries({ queryKey: detailKey })
      })
    }
    const handleUpdate = (updatedMatch: MatchDetails) => {
      queryClient.setQueryData(detailKey, updatedMatch)
    }
    const handleDisconnect = () => setConnectedMatchId(null)

    socket.on('connect', joinMatch)
    socket.on('disconnect', handleDisconnect)
    socket.on('match:update', handleUpdate)
    socket.connect()

    return () => {
      socket.emit('match:leave', matchId)
      socket.disconnect()
      socket.removeAllListeners()
    }
  }, [matchId, matchStatus, queryClient])

  const match = matchQuery.data
  const socketConnected = connectedMatchId === matchId && match?.status === 'live'
  const currentInnings = match?.innings.find(
    (inning) => inning.innings_number === match.current_innings_number,
  ) ?? match?.innings[match.innings.length - 1]

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-6xl px-5 pb-14 pt-5 sm:px-8 sm:pt-8">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink/60 transition hover:text-forest" to="/">
          <ArrowLeft size={16} /> All matches
        </Link>

        {!validMatchId ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white px-6 text-center" role="alert">
            <CircleAlert className="text-red-600" size={24} />
            <strong className="font-display text-lg">That match link isn’t valid</strong>
            <span className="text-sm text-ink/55">Go back to the match list and choose a match.</span>
          </div>
        ) : matchQuery.isPending ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white text-center" role="status">
            <span className="size-8 animate-spin rounded-full border-2 border-forest/15 border-t-forest" />
            <strong className="font-display">Opening the scorecard</strong>
            <span className="text-sm text-ink/55">Getting the latest from the score server…</span>
          </div>
        ) : matchQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white px-6 text-center" role="alert">
            <CircleAlert className="text-red-600" size={24} />
            <strong className="font-display text-lg">Couldn’t load this match</strong>
            <span className="max-w-lg text-sm leading-6 text-ink/60">{getApiErrorMessage(matchQuery.error)}</span>
            <button className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest" type="button" onClick={() => void matchQuery.refetch()}>
              Try again <RefreshCw size={14} />
            </button>
          </div>
        ) : match ? (
          <>
            <MatchHeader match={match} socketConnected={socketConnected} />
            {match.innings.length === 0 ? (
              <div className="mt-5 flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-lime/40 text-forest"><Activity size={21} /></span>
                <strong className="font-display text-lg">Match not started</strong>
                <span className="text-sm text-ink/55">The scorecard will appear here when the director starts play.</span>
              </div>
            ) : (
              <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
                <div className="space-y-5">
                  {match.innings.map((inning) => (
                    <InningsScorecard key={inning.id} inning={inning} />
                  ))}
                </div>
                <div className="space-y-5 lg:sticky lg:top-5">
                  {currentInnings && <RecentBalls inning={currentInnings} />}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </SiteLayout>
  )
}
