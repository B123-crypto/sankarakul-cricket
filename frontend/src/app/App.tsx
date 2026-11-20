import { Router } from './Router'
import { AppProviders } from './Provider'

function App() {
  return (
    <AppProviders>
      <Router />
    </AppProviders>
  )
}

export default App
