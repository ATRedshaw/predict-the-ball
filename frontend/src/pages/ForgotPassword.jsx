import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { buildAuthPath, getReturnTo } from '../authRedirect'
import NewPasswordField, { PasswordInput, PasswordMatchStatus } from '../components/PasswordField'

const STEPS = { EMAIL: 'email', RESET: 'reset', DONE: 'done' }

export default function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = getReturnTo(location.search)
  const loginPath = buildAuthPath('/login', returnTo)

  const [step,        setStep]        = useState(STEPS.EMAIL)
  const [email,       setEmail]       = useState('')
  const [code,        setCode]        = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [info,        setInfo]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [cooldown,    setCooldown]    = useState(false)

  function startCooldown() {
    setCooldown(true)
    setTimeout(() => setCooldown(false), 60_000)
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await api.post('/api/auth/forgot-password', { email })
      setInfo(data.message)
      startCooldown()
      setStep(STEPS.RESET)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setLoading(true)

    try {
      const data = await api.post('/api/auth/resend-reset-code', { email })
      setInfo(data.message)
      startCooldown()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)

    try {
      await api.post('/api/auth/reset-forgotten-password', {
        email,
        code,
        new_password: newPassword,
      })
      setStep(STEPS.DONE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-jet-dark rounded-2xl p-8">

          {step === STEPS.EMAIL && (
            <>
              <h1 className="text-white text-2xl font-bold mb-1">Forgot password</h1>
              <p className="text-teal-muted text-sm mb-8">
                Enter the email address on your account and we'll send a reset code.
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                  {loading ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            </>
          )}

          {step === STEPS.RESET && (
            <>
              <h1 className="text-white text-2xl font-bold mb-1">Reset password</h1>
              <p className="text-teal-muted text-sm mb-8">
                Enter the 6-digit code sent to <span className="text-teal">{email}</span> and choose a new password.
              </p>

              {info && (
                <p className="text-teal text-xs bg-teal/10 border border-teal/20 rounded-xl px-4 py-3 mb-4">
                  {info}
                </p>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                    Reset code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors tracking-widest"
                    placeholder="123456"
                  />
                </div>

                <NewPasswordField
                  id="forgot-new-password"
                  label="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />

                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                    Confirm password
                  </label>
                  <PasswordInput
                    id="forgot-confirm-password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    describedBy={confirm ? 'forgot-password-match' : undefined}
                  />
                  <PasswordMatchStatus
                    id="forgot-password-match"
                    password={newPassword}
                    confirmation={confirm}
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
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>

              <button
                onClick={handleResend}
                disabled={loading || cooldown}
                className="mt-4 w-full text-teal-muted text-xs hover:text-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cooldown ? 'Resend available in ~60 s' : "Didn't get the code? Resend"}
              </button>
            </>
          )}

          {step === STEPS.DONE && (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal/20 mb-6">
                <svg className="w-6 h-6 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-white text-2xl font-bold mb-1">Password updated</h1>
              <p className="text-teal-muted text-sm mb-8">
                Your password has been reset. Sign in with your new credentials.
              </p>
              <button
                onClick={() => navigate(loginPath)}
                className="w-full bg-teal text-white font-semibold text-sm py-3 rounded-xl hover:bg-jet transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}

          {step !== STEPS.DONE && (
            <p className="text-teal-muted text-xs text-center mt-6">
              Remembered it?{' '}
              <Link to={loginPath} className="text-teal hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
