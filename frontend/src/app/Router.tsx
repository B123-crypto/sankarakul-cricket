import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { CreateMatchPage } from '../pages/CreateMatchPage'
import { DirectorDashboardPage } from '../pages/DirectorDashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { MatchDetailsPage } from '../pages/MatchDetailsPage'
import { MatchesPage } from '../pages/MatchesPage'
import { ScoringPage } from '../pages/ScoringPage'
import { TeamsPage } from '../pages/TeamsPage'

function DirectorRoutes() {
  const { director } = useAuth()
  return director ? <Outlet /> : <Navigate to="/director/login" replace />
}

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MatchesPage />} />
        <Route path="/matches/:matchId" element={<MatchDetailsPage />} />
        <Route path="/director/login" element={<LoginPage />} />
        <Route element={<DirectorRoutes />}>
          <Route path="/director" element={<DirectorDashboardPage />} />
          <Route path="/director/teams" element={<TeamsPage />} />
          <Route path="/director/matches/new" element={<CreateMatchPage />} />
          <Route path="/director/matches/:matchId" element={<ScoringPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}