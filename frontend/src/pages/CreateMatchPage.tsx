import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { getApiData, getApiErrorMessage, postApiData } from '../lib/api'
import type { MatchDetails } from '../types/match'
import type { Team } from '../types/team'

const labelClass = 'block space-y-1.5 text-xs font-semibold text-ink/70'
const inputClass = 'min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10'

export function CreateMatchPage() {
  const navigate = useNavigate()
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [format, setFormat] = useState('CUSTOM')
  const [overs, setOvers] = useState('20')
  const [bowlerLimit, setBowlerLimit] = useState('')
  const [venue, setVenue] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => getApiData<Team[]>('/teams'),
  })
  const createMatch = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        homeTeamId,
        awayTeamId,
        format,
        oversPerInnings: Number(overs),
        venue: venue.trim() || null,
      }
      if (bowlerLimit) body.maxOversPerBowler = Number(bowlerLimit)
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString()
      return postApiData<MatchDetails>('/admin/matches', body)
    },
    onSuccess: (match) => navigate(`/director/matches/${match.id}`),
  })

  const maxBowlerOvers = Math.ceil(Number(overs) / 5)

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 hover:text-forest" to="/director">
          <ArrowLeft size={16} /> Director desk
        </Link>
        <div className="mt-5">
          <p className="font-mono text-[10px] tracking-[0.18em] text-forest">MATCH SETUP</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Create a match</h1>
          <p className="mt-2 text-sm text-ink/55">Choose the sides and match conditions. You can start scoring when ready.</p>
        </div>

        <form
          className="mt-6 space-y-6 rounded-2xl bg-white p-5 ring-1 ring-black/10 sm:p-7"
          onSubmit={(event) => {
            event.preventDefault()
            createMatch.mutate()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Home team
              <select className={inputClass} value={homeTeamId} onChange={(event) => setHomeTeamId(event.target.value)} required>
                <option value="">Select a team</option>
                {(teamsQuery.data ?? []).map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}
              </select>
            </label>
            <label className={labelClass}>Away team
              <select className={inputClass} value={awayTeamId} onChange={(event) => setAwayTeamId(event.target.value)} required>
                <option value="">Select a team</option>
                {(teamsQuery.data ?? []).filter((team) => String(team.id) !== homeTeamId).map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}
              </select>
            </label>
          </div>
          {teamsQuery.isPending && <p className="text-xs text-ink/50">Loading teams…</p>}
          {teamsQuery.isError && <p className="text-xs text-red-700" role="alert">{getApiErrorMessage(teamsQuery.error)}</p>}
          {teamsQuery.isSuccess && teamsQuery.data.length < 2 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Create at least two teams before scheduling a match.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Format
              <select className={inputClass} value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="CUSTOM">Custom</option><option value="T10">T10</option><option value="T20">T20</option><option value="ODI">ODI</option>
              </select>
            </label>
            <label className={labelClass}>Overs per innings (1–100)
              <input className={inputClass} type="number" min={1} max={100} step={1} value={overs} onChange={(event) => setOvers(event.target.value)} required />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Maximum overs per bowler
              <input className={inputClass} type="number" min={1} max={Number(overs) || 100} step={1} value={bowlerLimit} onChange={(event) => setBowlerLimit(event.target.value)} placeholder={`Default: ${maxBowlerOvers || '—'} overs`} />
              <span className="block font-normal text-ink/45">Default is one-fifth of innings overs, rounded up.</span>
            </label>
            <label className={labelClass}>Venue <span className="font-normal text-ink/45">(optional)</span>
              <input className={inputClass} value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={200} placeholder="Ground or location" />
            </label>
          </div>

          <label className={labelClass}>Scheduled time <span className="font-normal text-ink/45">(optional)</span>
            <span className="relative block">
              <CalendarDays className="absolute left-3 top-3 text-ink/40" size={16} />
              <input className={`${inputClass} pl-10`} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </span>
          </label>

          {createMatch.isError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{getApiErrorMessage(createMatch.error)}</p>}
          <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-sm font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={createMatch.isPending || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId || !teamsQuery.data || teamsQuery.data.length < 2 || !Number.isInteger(Number(overs)) || Number(overs) < 1 || Number(overs) > 100 || (bowlerLimit !== '' && (!Number.isInteger(Number(bowlerLimit)) || Number(bowlerLimit) < 1 || Number(bowlerLimit) > Number(overs)))}>
            <Plus size={16} /> {createMatch.isPending ? 'Creating match…' : 'Create scheduled match'}
          </button>
        </form>
      </main>
    </SiteLayout>
  )
}
