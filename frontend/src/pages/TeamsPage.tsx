import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Pencil, Plus, UserRound, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { getApiData, getApiErrorMessage, patchApiData, postApiData } from '../lib/api'
import type { Player, PlayerRole, Team } from '../types/team'

const roles: { value: PlayerRole; label: string }[] = [
  { value: 'batter', label: 'Batter' },
  { value: 'bowler', label: 'Bowler' },
  { value: 'all_rounder', label: 'All-rounder' },
  { value: 'wicket_keeper', label: 'Wicket keeper' },
]

const inputClass = 'min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10'
const labelClass = 'block space-y-1.5 text-xs font-semibold text-ink/70'

export function TeamsPage() {
  const queryClient = useQueryClient()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [shortName, setShortName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerRole, setPlayerRole] = useState<PlayerRole>('batter')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState('')
  const [editingPlayerRole, setEditingPlayerRole] = useState<PlayerRole>('batter')
  const [editingJerseyNumber, setEditingJerseyNumber] = useState('')

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => getApiData<Team[]>('/teams'),
  })
  const playersQuery = useQuery({
    queryKey: ['team-players', selectedTeamId],
    queryFn: () => getApiData<Player[]>(`/admin/teams/${selectedTeamId}/players?includeInactive=true`),
    enabled: Boolean(selectedTeamId),
  })

  const saveTeam = useMutation({
    mutationFn: () => selectedTeamId
      ? patchApiData<Team>(`/admin/teams/${selectedTeamId}`, { name: teamName.trim(), shortName: shortName.trim() })
      : postApiData<Team>('/admin/teams', { name: teamName.trim(), shortName: shortName.trim() }),
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      setSelectedTeamId(String(team.id))
      setTeamName(team.name)
      setShortName(team.short_name)
    },
  })
  const addPlayer = useMutation({
    mutationFn: () => postApiData<Player>(`/admin/teams/${selectedTeamId}/players`, {
      name: playerName.trim(),
      role: playerRole,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
    }),
    onSuccess: async () => {
      setPlayerName('')
      setJerseyNumber('')
      await queryClient.invalidateQueries({ queryKey: ['team-players', selectedTeamId] })
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
  const setPlayerActive = useMutation({
    mutationFn: ({ player, isActive }: { player: Player; isActive: boolean }) =>
      patchApiData<Player>(`/admin/players/${player.id}`, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-players', selectedTeamId] })
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
  const updatePlayer = useMutation({
    mutationFn: () => patchApiData<Player>(`/admin/players/${editingPlayerId}`, {
      name: editingPlayerName.trim(),
      role: editingPlayerRole,
      jerseyNumber: editingJerseyNumber ? Number(editingJerseyNumber) : null,
    }),
    onSuccess: async () => {
      setEditingPlayerId(null)
      await queryClient.invalidateQueries({ queryKey: ['team-players', selectedTeamId] })
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })

  const selectTeam = (team: Team) => {
    setSelectedTeamId(String(team.id))
    setTeamName(team.name)
    setShortName(team.short_name)
  }

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 hover:text-forest" to="/director">
          <ArrowLeft size={16} /> Director desk
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[10px] tracking-[0.18em] text-forest">TOURNAMENT ROSTERS</p><h1 className="mt-1 font-display text-3xl font-semibold">Teams & players</h1></div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-ink/55 ring-1 ring-black/10"><Users size={14} /> {teamsQuery.data?.length ?? 0} teams</span>
        </div>

        {teamsQuery.isError && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{getApiErrorMessage(teamsQuery.error)}</p>}

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="space-y-4">
            <form
              className="rounded-2xl bg-white p-5 ring-1 ring-black/10"
              onSubmit={(event) => {
                event.preventDefault()
                saveTeam.mutate()
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{selectedTeamId ? 'Edit team' : 'Add a team'}</h2>
                {selectedTeamId && <button className="text-xs font-semibold text-forest hover:underline" type="button" onClick={() => { setSelectedTeamId(null); setTeamName(''); setShortName('') }}>New team</button>}
              </div>
              <div className="space-y-3">
                <label className={labelClass}>Team name<input className={inputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={120} required placeholder="e.g. Riverside Cricket Club" /></label>
                <label className={labelClass}>Short name<input className={inputClass} value={shortName} onChange={(event) => setShortName(event.target.value)} maxLength={12} required placeholder="e.g. RCC" /></label>
              </div>
              {saveTeam.isError && <p className="mt-3 text-xs text-red-700" role="alert">{getApiErrorMessage(saveTeam.error)}</p>}
              <button className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-sm font-bold text-white hover:bg-ink disabled:opacity-60" type="submit" disabled={saveTeam.isPending || !teamName.trim() || !shortName.trim()}>
                {saveTeam.isPending ? 'Saving…' : <><Check size={15} />{selectedTeamId ? 'Save team changes' : 'Create team'}</>}
              </button>
            </form>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <h2 className="px-1 pb-3 font-display text-base font-semibold">Tournament teams</h2>
              {teamsQuery.isPending ? <p className="px-1 py-4 text-sm text-ink/50">Loading teams…</p> : (teamsQuery.data ?? []).length === 0 ? (
                <p className="px-1 py-4 text-sm leading-6 text-ink/50">No teams yet. Create the first team above.</p>
              ) : (
                <div className="space-y-1">
                  {(teamsQuery.data ?? []).map((team) => (
                    <button className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedTeamId === String(team.id) ? 'bg-lime/35' : 'hover:bg-paper'}`} key={team.id} type="button" onClick={() => selectTeam(team)}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper font-display text-xs font-bold text-forest">{team.short_name.slice(0, 3)}</span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{team.name}</strong><small className="text-ink/50">{team.player_count ?? 0} active players</small></span>
                      {selectedTeamId === String(team.id) && <Check size={16} className="text-forest" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-black/10 sm:p-6">
            {!selectedTeamId ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <span className="grid size-12 place-items-center rounded-full bg-paper text-forest"><UserRound size={20} /></span>
                <h2 className="mt-3 font-display text-lg font-semibold">Choose a team</h2>
                <p className="mt-1 max-w-xs text-sm leading-6 text-ink/50">Select a team to view its roster and add or deactivate players.</p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div><p className="font-mono text-[10px] tracking-wider text-forest">TEAM ROSTER</p><h2 className="mt-1 font-display text-xl font-semibold">{teamsQuery.data?.find((team) => String(team.id) === selectedTeamId)?.name}</h2></div>
                  <span className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink/55">{playersQuery.data?.length ?? 0} players</span>
                </div>

                <form
                  className="grid gap-3 rounded-xl bg-paper/70 p-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    addPlayer.mutate()
                  }}
                >
                  <label className={`${labelClass} sm:col-span-2`}>Player name<input className={inputClass} value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={120} required placeholder="Player full name" /></label>
                  <label className={labelClass}>Role<select className={inputClass} value={playerRole} onChange={(event) => setPlayerRole(event.target.value as PlayerRole)}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
                  <label className={labelClass}>Jersey number<input className={inputClass} type="number" min={1} max={999} value={jerseyNumber} onChange={(event) => setJerseyNumber(event.target.value)} placeholder="Optional" /></label>
                  {addPlayer.isError && <p className="text-xs text-red-700 sm:col-span-2" role="alert">{getApiErrorMessage(addPlayer.error)}</p>}
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-forest disabled:opacity-60 sm:col-span-2" type="submit" disabled={addPlayer.isPending || !playerName.trim()}>
                    <Plus size={15} />{addPlayer.isPending ? 'Adding…' : 'Add player'}
                  </button>
                </form>

                <div className="mt-5 divide-y divide-black/5">
                  {playersQuery.isPending ? <p className="py-6 text-center text-sm text-ink/50">Loading roster…</p> : playersQuery.isError ? (
                    <p className="py-5 text-sm text-red-700" role="alert">{getApiErrorMessage(playersQuery.error)}</p>
                  ) : (playersQuery.data ?? []).length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink/50">No players in this roster yet.</p>
                  ) : (
                    playersQuery.data?.map((player) => editingPlayerId === String(player.id) ? (
                      <form className="grid gap-2 py-3 sm:grid-cols-[1fr_1fr_90px_auto]" key={player.id} onSubmit={(event) => { event.preventDefault(); updatePlayer.mutate() }}>
                        <input className={inputClass} aria-label="Player name" value={editingPlayerName} onChange={(event) => setEditingPlayerName(event.target.value)} maxLength={120} required />
                        <select className={inputClass} aria-label="Player role" value={editingPlayerRole} onChange={(event) => setEditingPlayerRole(event.target.value as PlayerRole)}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
                        <input className={inputClass} aria-label="Jersey number" type="number" min={1} max={999} value={editingJerseyNumber} onChange={(event) => setEditingJerseyNumber(event.target.value)} placeholder="Number" />
                        <span className="flex gap-1">
                          <button className="grid size-10 place-items-center rounded-lg bg-forest text-white disabled:opacity-50" type="submit" aria-label="Save player" disabled={updatePlayer.isPending || !editingPlayerName.trim()}><Check size={15} /></button>
                          <button className="grid size-10 place-items-center rounded-lg bg-paper text-ink/60" type="button" aria-label="Cancel edit" onClick={() => setEditingPlayerId(null)}><X size={15} /></button>
                        </span>
                      </form>
                    ) : (
                      <div className={`flex flex-wrap items-center gap-3 py-3 ${player.is_active ? '' : 'opacity-55'}`} key={player.id}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper font-mono text-xs font-bold text-forest">{player.jersey_number ?? '—'}</span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{player.name}</strong><small className="text-xs text-ink/50">{roles.find((role) => role.value === player.role)?.label ?? player.role}{!player.is_active ? ' · Inactive' : ''}</small></span>
                        <button
                          className="grid size-9 place-items-center rounded-full text-ink/45 hover:bg-paper hover:text-forest"
                          type="button"
                          aria-label={`Edit ${player.name}`}
                          onClick={() => {
                            setEditingPlayerId(String(player.id))
                            setEditingPlayerName(player.name)
                            setEditingPlayerRole(player.role)
                            setEditingJerseyNumber(player.jersey_number ? String(player.jersey_number) : '')
                          }}
                        ><Pencil size={14} /></button>
                        <button
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${player.is_active ? 'border-black/10 text-ink/55 hover:border-red-200 hover:text-red-700' : 'border-forest/20 text-forest hover:bg-lime/25'}`}
                          type="button"
                          disabled={setPlayerActive.isPending}
                          onClick={() => {
                            if (!player.is_active || window.confirm(`Deactivate ${player.name}? They will no longer be selectable for new deliveries.`)) {
                              setPlayerActive.mutate({ player, isActive: !player.is_active })
                            }
                          }}
                        >
                          {player.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    ))
                  )}
                  {setPlayerActive.isError && <p className="py-3 text-xs text-red-700" role="alert">{getApiErrorMessage(setPlayerActive.error)}</p>}
                  {updatePlayer.isError && <p className="py-3 text-xs text-red-700" role="alert">{getApiErrorMessage(updatePlayer.error)}</p>}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </SiteLayout>
  )
}
