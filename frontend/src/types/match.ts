export type MatchStatus = 'live' | 'scheduled' | 'completed' | 'abandoned'

export interface MatchSummary {
  id: string | number
  format: string
  status: MatchStatus
  venue: string | null
  scheduled_at: string | null
  overs_per_innings: number
  max_overs_per_bowler?: number
  result_text: string | null
  winner_team_id: string | number | null
  home_team_id: string | number
  home_team_name: string
  home_team_short_name: string
  away_team_id: string | number
  away_team_name: string
  away_team_short_name: string
  current_innings_id: string | number | null
  current_innings_number: number | null
  current_batting_team_id: string | number | null
  current_total_runs: number | null
  current_wickets: number | null
  current_legal_balls: number | null
  current_target_runs: number | null
  current_innings_status: string | null
}

export interface BattingFigure {
  player_id: string | number
  player_name: string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  is_out: boolean
  strike_rate: number | null
}

export interface BowlingFigure {
  player_id: string | number
  player_name: string
  legal_balls: number
  runs_conceded: number
  wickets: number
  economy: number | null
}

export interface MatchDelivery {
  delivery_number: number
  striker_id: string | number
  striker_name: string
  non_striker_id: string | number
  non_striker_name: string
  bowler_id: string | number
  bowler_name: string
  batter_runs: number
  is_boundary: boolean
  wide_runs: number
  no_ball_runs: number
  bye_runs: number
  leg_bye_runs: number
  penalty_runs: number
  total_extras: number
  legal_ball: boolean
  total_runs: number
  wicket_type: string | null
  dismissed_player_id: string | number | null
  dismissed_player_name: string | null
  created_at: string
}

export interface MatchInnings {
  id: string | number
  innings_number: number
  batting_team_id: string | number
  batting_team_name: string
  bowling_team_id: string | number
  bowling_team_name: string
  status: string
  total_runs: number
  wickets: number
  legal_balls: number
  target_runs: number | null
  started_at: string | null
  completed_at: string | null
  current_striker_id: string | number | null
  current_striker_name: string | null
  current_non_striker_id: string | number | null
  current_non_striker_name: string | null
  current_bowler_id: string | number | null
  current_bowler_name: string | null
  batting: BattingFigure[]
  bowling: BowlingFigure[]
  extras: { extras_type: string; runs: number }[]
  deliveries: MatchDelivery[]
}

export interface MatchDetails extends MatchSummary {
  innings: MatchInnings[]
}
