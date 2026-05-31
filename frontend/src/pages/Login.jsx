import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Login() {
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Step 2 — verify email
  const [step,   setStep]   = useState(1)
  const [code,   setCode]   = useState('')
  const [resent, setResent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await api.post('/api/auth/login', { email, password }, true)
      localStorage.setItem('access_token', data.access_token)
      const me = await api.get('/api/auth/me')
      localStorage.setItem('first_name', me.first_name)
      navigate('/home')
    } catch (err) {
      if (err.code === 'email_not_verified') {
        setError('')
        setStep(2)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/api/auth/verify-email', { email, code })
      // Email confirmed — log straight in.
      const data = await api.post('/api/auth/login', { email, password }, true)
      localStorage.setItem('access_token', data.access_token)
      const me = await api.get('/api/auth/me')
      localStorage.setItem('first_name', me.first_name)
      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setResent(false)

    try {
      await api.post('/api/auth/resend-verification', { email })
      setResent(true)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-jet-dark rounded-2xl p-8">

          {step === 1 ? (
            <>
              <h1 className="text-white text-2xl font-bold mb-1">Welcome back</h1>
              <p className="text-teal-muted text-sm mb-8">Sign in to your account to continue.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-teal-muted text-xs uppercase tracking-widest">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-teal-muted text-xs hover:text-teal transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal text-white font-semibold text-sm py-3 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="text-teal-muted text-xs text-center mt-6">
                No account?{' '}
                <Link to="/signup" className="text-teal hover:text-white transition-colors">
                  Create one free
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-white text-2xl font-bold mb-1">Check your email</h1>
              <p className="text-teal-muted text-sm mb-2">
                We sent a 6-digit code to <span className="text-white">{email}</span>.
              </p>
              <p className="text-teal-muted text-xs mb-8 opacity-70">It expires in 15 minutes.</p>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm tracking-[0.5em] text-center placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {resent && (
                  <p className="text-teal text-xs bg-teal/10 border border-teal/20 rounded-xl px-4 py-3">
                    A new code has been sent.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal text-white font-semibold text-sm py-3 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying…' : 'Verify email'}
                </button>
              </form>

              <p className="text-teal-muted text-xs text-center mt-6">
                Didn't get it?{' '}
                <button
                  onClick={handleResend}
                  className="text-teal hover:text-white transition-colors"
                >
                  Resend code
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
