import { Link } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

export function SiteLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between border-b border-black/10 px-5 sm:px-8">
        <Link className="flex items-center gap-2" to="/" aria-label="Sankarakul Cricket League home">
          <img
            alt="Sankarakul Cricket League logo"
            className="size-11 rounded-full border border-forest/15 object-cover"
            height={44}
            src="/sankarakul-logo.jpeg"
            width={44}
          />
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-forest sm:text-xs">
            SANKARAKUL CRICKET LEAGUE
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold sm:flex" aria-label="Main navigation">
          <Link className="text-ink" to="/">Matches</Link>
          <Link className="text-ink/60 transition hover:text-forest" to="/director/teams">Teams</Link>
          <Link className="text-ink/60 transition hover:text-forest" to="/director">Director</Link>
        </nav>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-ink/60">
          <span className="size-2 rounded-full bg-lime-600" />
          LOCAL CRICKET, LIVE
        </div>
      </header>

      {children}

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-black/10 px-5 py-6 text-[10px] font-semibold tracking-[0.13em] text-ink/45 sm:flex-row sm:px-8">
        <Link className="font-display text-xs font-bold tracking-[0.16em] text-ink" to="/">
          BOUNDARY<span className="text-forest">.</span>
        </Link>
        <span>THE SCORE, AS IT HAPPENS.</span>
        <span>BUILT FOR THE LOCAL GAME</span>
      </footer>
    </div>
  )
}
