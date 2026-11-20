export interface Team {
  id: string | number
  name: string
  short_name: string
  player_count?: number
}

export type PlayerRole = 'batter' | 'bowler' | 'all_rounder' | 'wicket_keeper'

export interface Player {
  id: string | number
  team_id: string | number
  name: string
  role: PlayerRole
  jersey_number: number | null
  is_active: boolean
}
