import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  Flag,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { getApiData, getApiErrorMessage, postApiData, deleteApiData } from '../lib/api'
import { matchQueryKeys } from '../lib/queryClient'
import type { MatchDetails } from '../types/match'
import type { Player, PlayerRole } from '../types/team'

const wicketTypes = [
  ['bowled', 'Bowled'],
  ['caught', 'Caught'],
  ['lbw', 'LBW'],
  ['run_out', 'Run out'],
  ['stumped', 'Stumped'],
  ['hit_wicket', 'Hit wicket'],
  ['obstructing_field', 'Obstructing the field'],
  ['hit_ball_twice', 'Hit the ball twice'],
] as const
const extrasKeys = ['wide', 'noBall', 'bye', 'legBye', 'penalty'] as const
type ExtrasKey = typeof extrasKeys[number]
type Extras = Record<ExtrasKey, number>
const zeroExtras = (): Extras => ({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 })
const inputClass = 'min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10'
const labelClass = 'block space-y-1.5 text-xs font-semibold text-ink/70'

function activePlayers(players: Player[] | undefined, role?: PlayerRole) {
  return (players ?? []).filter((player) => player.is_active && (!role || player.role === role || player.role === 'all_rounder'))
}

function SelectPlayer({
  label,
  value,
  players,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  players: Player[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className={labelClass}>{label}
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required>
        <option value="">Select player</option>
        {players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.jersey_number ? ` · #${player.jersey_number}` : ''}</option>)}
      </select>
    </label>
  )
}

function SetupInnings({
  match,
  secondInnings,
  homePlayers,
  awayPlayers,
  onStart,
  pending,
  error,
}: {
  match: MatchDetails
  secondInnings: boolean
  homePlayers: Player[]
  awayPlayers: Player[]
  onStart: (values: { battingFirstTeamId?: string; strikerId: string; nonStrikerId: string; bowlerId: string }) => void
  pending: boolean
  error: string | null
}) {
  const [battingTeamId, setBattingTeamId] = useState(secondInnings ? String(match.away_team_id) : '')
  const [strikerId, setStrikerId] = useState('')
  const [nonStrikerId, setNonStrikerId] = useState('')
  const [bowlerId, setBowlerId] = useState('')
  const battingId = secondInnings ? String(match.away_team_id) : battingTeamId
  const bowlingId = battingId === String(match.home_team_id)
    ? String(match.away_team_id)
    : String(match.home_team_id)
  const battingPlayers = battingId === String(match.home_team_id) ? homePlayers : awayPlayers
  const bowlingPlayers = bowlingId === String(match.home_team_id) ? homePlayers : awayPlayers

  return (
    <form
      className="mt-5 space-y-5 rounded-2xl bg-white p-5 ring-1 ring-black/10 sm:p-7"
      onSubmit={(event) => {
        event.preventDefault()
        onStart({
          ...(secondInnings ? {} : { battingFirstTeamId: battingTeamId }),
          strikerId,
          nonStrikerId,
          bowlerId,
        })
      }}
    >
      {!secondInnings && (
        <label className={labelClass}>Batting first
          <select className={inputClass} value={battingTeamId} onChange={(event) => { setBattingTeamId(event.target.value); setStrikerId(''); setNonStrikerId(''); setBowlerId('') }} required>
            <option value="">Choose who bats first</option>
            <option value={match.home_team_id}>{match.home_team_name}</option>
            <option value={match.away_team_id}>{match.away_team_name}</option>
          </select>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectPlayer label="Opening striker" value={strikerId} players={battingPlayers} onChange={setStrikerId} disabled={!battingId} />
        <SelectPlayer label="Opening non-striker" value={nonStrikerId} players={battingPlayers.filter((player) => String(player.id) !== strikerId)} onChange={setNonStrikerId} disabled={!battingId} />
        <div className="sm:col-span-2">        <SelectPlayer label="Opening bowler" value={bowlerId} players={activePlayers(bowlingPlayers, 'bowler')} onChange={setBowlerId} disabled={!battingId} /></div>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <button className="min-h-12 w-full rounded-xl bg-forest text-sm font-bold text-white hover:bg-ink disabled:opacity-50" type="submit" disabled={pending || !battingId || !strikerId || !nonStrikerId || strikerId === nonStrikerId || !bowlerId}>
        {pending ? 'Starting…' : secondInnings ? 'Start second innings' : 'Start match'}
      </button>
    </form>
  )
}

export function ScoringPage() {
  const { matchId = '' } = useParams()
  const queryClient = useQueryClient()
  const queryKey = matchQueryKeys.detail(matchId)
  const matchQuery = useQuery({
    queryKey,
    queryFn: () => getApiData<MatchDetails>(`/matches/${encodeURIComponent(matchId)}`),
    enabled: /^\d+$/.test(matchId),
  })
  const match = matchQuery.data
  const homeTeamId = match ? String(match.home_team_id) : ''
  const awayTeamId = match ? String(match.away_team_id) : ''
  const homePlayersQuery = useQuery({
    queryKey: ['team-players', homeTeamId],
    queryFn: () => getApiData<Player[]>(`/admin/teams/${homeTeamId}/players?includeInactive=true`),
    enabled: Boolean(homeTeamId),
  })
  const awayPlayersQuery = useQuery({
    queryKey: ['team-players', awayTeamId],
    queryFn: () => getApiData<Player[]>(`/admin/teams/${awayTeamId}/players?includeInactive=true`),
    enabled: Boolean(awayTeamId),
  })
  const [runs, setRuns] = useState(0)
  const [boundary, setBoundary] = useState(false)
  const [extras, setExtras] = useState<Extras>(zeroExtras)
  const [wicketType, setWicketType] = useState('')
  const [dismissedPlayerId, setDismissedPlayerId] = useState('')
  const [nextStrikerId, setNextStrikerId] = useState('')
  const [nextNonStrikerId, setNextNonStrikerId] = useState('')
  const [selectedBowlerId, setSelectedBowlerId] = useState('')

  const updateMatch = (updatedMatch: MatchDetails) => {
    queryClient.setQueryData(queryKey, updatedMatch)
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.lists })
  }
  const startFirst = useMutation({
    mutationFn: (values: { battingFirstTeamId?: string; strikerId: string; nonStrikerId: string; bowlerId: string }) =>
      postApiData<MatchDetails>(`/admin/matches/${matchId}/start`, values),
    onSuccess: updateMatch,
  })
  const startSecond = useMutation({
    mutationFn: (values: { battingFirstTeamId?: string; strikerId: string; nonStrikerId: string; bowlerId: string }) =>
      postApiData<MatchDetails>(`/admin/matches/${matchId}/innings/2/start`, values),
    onSuccess: updateMatch,
  })
  const currentInnings = match?.innings[match.innings.length - 1]
  const selectedBowler = currentInnings?.current_bowler_id != null
    ? String(currentInnings.current_bowler_id)
    : selectedBowlerId

  const recordDelivery = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      postApiData<MatchDetails>(`/admin/innings/${currentInnings?.id}/deliveries`, body),
    onSuccess: (updatedMatch) => {
      updateMatch(updatedMatch)
      setRuns(0)
      setBoundary(false)
      setExtras(zeroExtras())
      setWicketType('')
      setDismissedPlayerId('')
      setNextStrikerId('')
      setNextNonStrikerId('')
      const newInnings = updatedMatch.innings[updatedMatch.innings.length - 1]
      setSelectedBowlerId(String(newInnings?.current_bowler_id ?? ''))
    },
  })
  const undoDelivery = useMutation({
    mutationFn: () => deleteApiData<MatchDetails>(`/admin/innings/${currentInnings?.id}/deliveries/latest`),
    onSuccess: updateMatch,
  })
  const completeInnings = useMutation({
    mutationFn: () => postApiData<MatchDetails>(`/admin/innings/${currentInnings?.id}/complete`, {}),
    onSuccess: updateMatch,
  })

  const teamPlayers = currentInnings?.batting_team_id
    ? String(currentInnings.batting_team_id) === homeTeamId
      ? homePlayersQuery.data ?? []
      : awayPlayersQuery.data ?? []
    : []
  const bowlers = currentInnings?.bowling_team_id
    ? String(currentInnings.bowling_team_id) === homeTeamId
      ? homePlayersQuery.data ?? []
      : awayPlayersQuery.data ?? []
    : []
  const strikerIds = [currentInnings?.current_striker_id, currentInnings?.current_non_striker_id].filter(Boolean).map(String)
  const isWicket = Boolean(wicketType)
  const allOut = Boolean(isWicket && currentInnings && currentInnings.wickets >= 9)
  const dismissedId = dismissedPlayerId
  const survivingBatterId = dismissedId === String(currentInnings?.current_striker_id)
    ? String(currentInnings?.current_non_striker_id ?? '')
    : String(currentInnings?.current_striker_id ?? '')
  const incomingPlayers = activePlayers(teamPlayers).filter((player) =>
    !strikerIds.includes(String(player.id)) &&
    !currentInnings?.batting.some((batter) => batter.is_out && String(batter.player_id) === String(player.id)),
  )
  const survivingPlayer = teamPlayers.find((player) => String(player.id) === survivingBatterId)
  const nextBatterOptions = isWicket
    ? [...(survivingPlayer ? [survivingPlayer] : []), ...incomingPlayers]
    : teamPlayers.filter((player) => strikerIds.includes(String(player.id)))
  const totalExtras = Object.values(extras).reduce((sum, value) => sum + value, 0)
  const extrasInvalid =
    (extras.wide > 0 && extras.noBall > 0) ||
    (extras.bye > 0 && extras.legBye > 0) ||
    (extras.wide > 0 && (extras.bye > 0 || extras.legBye > 0)) ||
    (runs > 0 && (extras.wide > 0 || extras.bye > 0 || extras.legBye > 0)) ||
    totalExtras > 100
  const wicketInvalid =
    (extras.noBall > 0 && isWicket && !['run_out', 'obstructing_field', 'hit_ball_twice'].includes(wicketType)) ||
    (extras.wide > 0 && isWicket && !['run_out', 'stumped', 'hit_wicket', 'obstructing_field'].includes(wicketType))
  const needsNextBatter = !allOut
  const playerTransitionsInvalid = isWicket
    ? (!dismissedPlayerId || (needsNextBatter && (!nextStrikerId || !nextNonStrikerId || nextStrikerId === nextNonStrikerId || ![nextStrikerId, nextNonStrikerId].includes(survivingBatterId))))
    : (!nextStrikerId || !nextNonStrikerId || nextStrikerId === nextNonStrikerId || !strikerIds.includes(nextStrikerId) || !strikerIds.includes(nextNonStrikerId))

  const submitDelivery = () => {
    if (!currentInnings || !selectedBowler || extrasInvalid || wicketInvalid || playerTransitionsInvalid) return
    recordDelivery.mutate({
      bowlerId: selectedBowler,
      batterRuns: runs,
      isBoundary: boundary,
      extras,
      wicketType: wicketType || null,
      dismissedPlayerId: isWicket ? dismissedPlayerId : null,
      nextStrikerId: allOut ? null : nextStrikerId,
      nextNonStrikerId: allOut ? null : nextNonStrikerId,
    })
  }

  const secondInningsReady = Boolean(
    match?.status === 'live' &&
    match.innings.length === 1 &&
    match.innings[0].status === 'completed',
  )

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 hover:text-forest" to="/director">
          <ArrowLeft size={16} /> Director desk
        </Link>

        {matchQuery.isPending ? (
          <p className="mt-6 rounded-xl bg-white p-5 text-sm text-ink/55">Loading match…</p>
        ) : matchQuery.isError ? (
          <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{getApiErrorMessage(matchQuery.error)}</p>
        ) : !match ? null : (
          <>
            <header className="mt-5 rounded-2xl bg-forest p-5 text-white sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-mono text-[10px] tracking-[0.16em] text-lime">DIRECTOR SCORING · {match.format} · {match.overs_per_innings} OVERS</p><h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{match.home_team_name} <span className="text-white/40">vs</span> {match.away_team_name}</h1></div>
                <Link className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/75 hover:bg-white/15" to={`/matches/${match.id}`}>Spectator view</Link>
              </div>
              {currentInnings && <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5"><div><span className="font-mono text-[10px] tracking-wider text-white/50">INNINGS {currentInnings.innings_number} · {currentInnings.batting_team_name}</span><strong className="mt-1 block font-display text-4xl">{currentInnings.total_runs}/{currentInnings.wickets}</strong></div><div className="text-sm text-white/65">{Math.floor(currentInnings.legal_balls / 6)}.{currentInnings.legal_balls % 6} overs{currentInnings.target_runs ? ` · Target ${currentInnings.target_runs}` : ''}</div></div>}
            </header>

            {match.status === 'scheduled' || secondInningsReady ? (
              <section className="mt-6">
                <p className="font-mono text-[10px] tracking-[0.15em] text-forest">{secondInningsReady ? 'CHASE SETUP' : 'TOSS & OPENERS'}</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">{secondInningsReady ? 'Start the second innings' : 'Set up the first innings'}</h2>
                {(homePlayersQuery.isError || awayPlayersQuery.isError) && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{getApiErrorMessage(homePlayersQuery.error ?? awayPlayersQuery.error)}</p>}
                <SetupInnings
                  match={match}
                  secondInnings={secondInningsReady}
                  homePlayers={activePlayers(homePlayersQuery.data)}
                  awayPlayers={activePlayers(awayPlayersQuery.data)}
                  onStart={(values) => secondInningsReady ? startSecond.mutate(values) : startFirst.mutate(values)}
                  pending={startFirst.isPending || startSecond.isPending}
                  error={startFirst.isError ? getApiErrorMessage(startFirst.error) : startSecond.isError ? getApiErrorMessage(startSecond.error) : null}
                />
              </section>
            ) : match.status === 'completed' || match.status === 'abandoned' ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6">
                <p className="font-mono text-[10px] tracking-wider text-forest">{match.status.toUpperCase()}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">{match.result_text ?? 'This match is finished.'}</h2>
                <p className="mt-2 text-sm text-ink/55">Scoring is disabled. View the public scorecard for full innings figures.</p>
                <Link className="mt-4 inline-block text-sm font-bold text-forest hover:underline" to={`/matches/${match.id}`}>Open scorecard →</Link>
              </div>
            ) : currentInnings?.status === 'live' ? (
              <section className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                <div className="space-y-5">
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-black/10 sm:p-6">
                    <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">This delivery</h2><span className="font-mono text-[10px] text-ink/45">NO AUTOMATIC RETRIES</span></div>
                    <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[0, 1, 2, 3, 4, 6].map((run) => (
                        <button className={`min-h-14 rounded-xl font-display text-xl font-bold transition ${runs === run && totalExtras === 0 ? 'bg-lime text-ink ring-2 ring-forest/20' : 'bg-paper hover:bg-lime/50'}`} key={run} type="button" onClick={() => { setRuns(run); setExtras(zeroExtras()); if (run !== 4 && run !== 6) setBoundary(false) }} aria-pressed={runs === run && totalExtras === 0}>
                          {run === 0 ? 'Dot' : run}
                        </button>
                      ))}
                    </div>
                    <label className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${runs === 4 || runs === 6 ? 'border-forest/20 bg-lime/20' : 'border-black/10 opacity-50'}`}>
                      <input className="size-4 accent-green-800" type="checkbox" checked={boundary} disabled={runs !== 4 && runs !== 6} onChange={(event) => setBoundary(event.target.checked)} />
                      Mark as an actual boundary (four or six)
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {extrasKeys.map((key) => (
                        <label className={labelClass} key={key}>{key === 'noBall' ? 'No-ball' : key === 'legBye' ? 'Leg-bye' : key[0].toUpperCase() + key.slice(1)} runs
                          <input className={inputClass} type="number" min={0} max={100} value={extras[key]} onChange={(event) => { const value = Number(event.target.value); if (key !== 'noBall' && (key === 'wide' || key === 'bye' || key === 'legBye') && value > 0) { setRuns(0); setBoundary(false) } setExtras((previous) => ({ ...previous, [key]: value })) }} />
                        </label>
                      ))}
                      <label className={labelClass}>Bowler
                        <select className={inputClass} value={selectedBowler} onChange={(event) => setSelectedBowlerId(event.target.value)} required>
                          <option value="">Select bowler for this over</option>
                          {activePlayers(bowlers, 'bowler').map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {currentInnings.current_bowler_id == null && currentInnings.legal_balls > 0 && currentInnings.legal_balls % 6 === 0 && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Over complete. Select the next bowler to continue.</p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white p-5 ring-1 ring-black/10 sm:p-6">
                    <div className="mb-4"><h2 className="font-display text-lg font-semibold">Wicket & next batters</h2><p className="mt-1 text-xs text-ink/50">Confirm both batter positions after every delivery.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={labelClass}>Wicket type <select className={inputClass} value={wicketType} onChange={(event) => { setWicketType(event.target.value); setDismissedPlayerId(''); setNextStrikerId(''); setNextNonStrikerId('') }}><option value="">No wicket</option>{wicketTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <SelectPlayer label="Dismissed batter" value={dismissedPlayerId} players={teamPlayers.filter((player) => strikerIds.includes(String(player.id)))} onChange={(value) => { setDismissedPlayerId(value); setNextStrikerId(''); setNextNonStrikerId('') }} disabled={!isWicket} />
                      {!allOut && (
                        <>
                          <SelectPlayer label="Next striker" value={nextStrikerId} players={nextBatterOptions} onChange={setNextStrikerId} />
                          <SelectPlayer label="Next non-striker" value={nextNonStrikerId} players={nextBatterOptions.filter((player) => String(player.id) !== nextStrikerId)} onChange={setNextNonStrikerId} />
                        </>
                      )}
                    </div>
                    {allOut && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">This is the tenth wicket. No batters should be selected after it.</p>}
                    {(extrasInvalid || wicketInvalid) && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">That combination of batter runs, extras, and wicket is not allowed. Check the delivery values.</p>}
                    {playerTransitionsInvalid && (isWicket || nextStrikerId || nextNonStrikerId) && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">Select valid, distinct next batters. After a wicket include the not-out batter and a new active batter.</p>}
                    {recordDelivery.isError && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert"><p>{getApiErrorMessage(recordDelivery.error)} Refresh the match before retrying to confirm the ball was not already recorded.</p><button className="mt-2 font-bold underline" type="button" onClick={() => void matchQuery.refetch()}>Refresh match</button></div>}
                    <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-sm font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={recordDelivery.isPending || !selectedBowler || extrasInvalid || wicketInvalid || playerTransitionsInvalid || (boundary && runs !== 4 && runs !== 6)} onClick={submitDelivery}>
                      <Check size={16} /> {recordDelivery.isPending ? 'Recording delivery…' : 'Record delivery'}
                    </button>
                  </div>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-5">
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-black/10">
                    <h2 className="font-display text-lg font-semibold">Current players</h2>
                    <div className="mt-4 space-y-3">
                      {[currentInnings.current_striker_name, currentInnings.current_non_striker_name].filter(Boolean).map((name, index) => <p className="flex items-center justify-between rounded-xl bg-paper p-3 text-sm" key={`${name}-${index}`}><span>{name}{index === 0 ? <i className="ml-2 inline-block size-1.5 rounded-full bg-lime-600 align-middle" /> : null}</span><small className="text-ink/45">{index === 0 ? 'STRIKER' : 'NON-STRIKER'}</small></p>)}
                      <p className="flex items-center justify-between border-t border-black/5 pt-3 text-sm"><span>{currentInnings.current_bowler_name ?? 'Choose next bowler'}</span><small className="text-ink/45">BOWLER</small></p>
                    </div>
                    <p className="mt-4 rounded-xl bg-paper p-3 text-xs leading-5 text-ink/55">
                      {currentInnings.target_runs ? `Chase target: ${currentInnings.target_runs}.` : 'First innings in progress.'} Strike changes are never guessed—select the next ends after each ball.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <h2 className="font-display text-base font-semibold">Innings controls</h2>
                    <button className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-semibold text-ink/65 hover:border-red-200 hover:text-red-700 disabled:opacity-50" type="button" disabled={undoDelivery.isPending || !currentInnings.deliveries.length} onClick={() => { if (window.confirm('Undo only the most recent delivery? The scorecard will be recalculated.')) undoDelivery.mutate() }}>
                      <RotateCcw size={15} /> {undoDelivery.isPending ? 'Undoing…' : 'Undo latest delivery'}
                    </button>
                    <button className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-semibold text-ink/65 hover:border-amber-300 hover:text-amber-800 disabled:opacity-50" type="button" disabled={completeInnings.isPending} onClick={() => { if (window.confirm('Complete this innings now? You cannot score more balls in this innings.')) completeInnings.mutate() }}>
                      <Flag size={15} /> {completeInnings.isPending ? 'Completing…' : 'Complete innings early'}
                    </button>
                    {(undoDelivery.isError || completeInnings.isError) && <p className="mt-3 text-xs text-red-700" role="alert">{getApiErrorMessage(undoDelivery.error ?? completeInnings.error)}</p>}
                  </div>

                  <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                    <ShieldAlert className="mt-0.5 shrink-0" size={16} />
                    <span>Scoring requests are sent once. If a request fails or times out, refresh the match before retrying.</span>
                  </div>
                </aside>
              </section>
            ) : (
              <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-black/10">
                <p className="font-display text-lg font-semibold">This innings is not accepting deliveries.</p>
                <Link className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline" to={`/matches/${match.id}`}>View scorecard <ArrowLeft className="rotate-180" size={15} /></Link>
              </div>
            )}
          </>
        )}
      </main>
    </SiteLayout>
  )
}
