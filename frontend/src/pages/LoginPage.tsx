import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SiteLayout } from '../components/layout/SiteLayout'
import { useAuth } from '../features/auth/useAuth'
import { getApiErrorMessage } from '../lib/api'

export function LoginPage() {
  const { director, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const loginMutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => navigate('/director', { replace: true }),
  })

  if (director) return <Navigate to="/director" replace />

  return (
    <SiteLayout>
      <main className="mx-auto grid min-h-[calc(100vh-130px)] w-full max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 sm:px-8">
        <section className="hidden rounded-3xl bg-forest p-10 text-white md:block">
          <span className="grid size-12 place-items-center rounded-2xl bg-lime text-forest">
            <ShieldCheck size={23} />
          </span>
          <p className="mt-12 font-mono text-[10px] tracking-[0.18em] text-lime">DIRECTOR ACCESS</p>
          <h1 className="mt-3 max-w-sm font-display text-4xl font-semibold leading-tight">
            You call the game.<br />We keep the score.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Sign in with your tournament director account to manage teams, matches, and every ball.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md">
          <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink/55 hover:text-forest" to="/">
            <ArrowLeft size={16} /> Back to matches
          </Link>
          <div className="mb-7">
            <p className="font-mono text-[10px] tracking-[0.18em] text-forest">ONE SCOREKEEPER. ONE SCORE.</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Director sign in</h1>
            <p className="mt-2 text-sm text-ink/55">Use the account set up for your tournament.</p>
          </div>

          <form
            className="space-y-5 rounded-2xl border border-black/10 bg-white p-5 sm:p-7"
            onSubmit={(event) => {
              event.preventDefault()
              loginMutation.mutate()
            }}
          >
            <label className="block space-y-2 text-sm font-semibold">
              Email address
              <input
                autoComplete="username"
                className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-normal outline-none transition placeholder:text-ink/35 focus:border-forest focus:ring-4 focus:ring-forest/10"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="director@example.com"
                required
              />
            </label>
            <label className="block space-y-2 text-sm font-semibold">
              Password
              <span className="relative block">
                <input
                  autoComplete="current-password"
                  className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 pr-12 font-normal outline-none transition placeholder:text-ink/35 focus:border-forest focus:ring-4 focus:ring-forest/10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                />
                <button
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink/45 hover:text-ink"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {loginMutation.isError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {getApiErrorMessage(loginMutation.error)}
              </p>
            )}
            <button
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-forest px-5 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={loginMutation.isPending || !email.trim() || !password}
            >
              {loginMutation.isPending ? 'Signing in…' : 'Sign in as director'}
            </button>
          </form>
          <p className="mt-5 text-xs leading-5 text-ink/45">
            Director accounts are provisioned separately. Public spectators do not need to sign in.
          </p>
        </section>
      </main>
    </SiteLayout>
  )
}
