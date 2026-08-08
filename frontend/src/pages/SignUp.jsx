import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { setAuthenticated } from '../authState'
import { buildAuthPath, getReturnTo } from '../authRedirect'
import NewPasswordField from '../components/PasswordField'
import { MAX_NAME_LENGTH } from '../nameValidation'
import { markInstallPromptAfterAuth } from '../pwa/installPrompt'

export default function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = getReturnTo(location.search)

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')

  // Step 2 field
  const [code, setCode] = useState('')

  const [step,    setStep]    = useState(1)   // 1 = register form, 2 = verify code
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [resent,  setResent]  = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/api/auth/register', {
        first_name: firstName,
        last_name:  lastName,
        email,
        password,
      })
      setStep(2)
    } catch (err) {
      setError(err.message)
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
      const data = await api.post('/api/auth/login', { email, password }, true)
      setAuthenticated(data.access_token, data.user)
      markInstallPromptAfterAuth()
      navigate(returnTo, { replace: true })
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
              <h1 className="text-white text-2xl font-bold mb-1">Create an account</h1>
              <p className="text-teal-muted text-sm mb-8">It's completely free!</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                      First name
                    </label>
                    <input
                      type="text"
                      autoComplete="given-name"
                      required
                      maxLength={MAX_NAME_LENGTH}
                      value={firstName}
                      onChange={e => setFirstName(e.target.value.replace(/\b\w/g, c => c.toUpperCase()))}
                      className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
                      placeholder="Alex"
                    />
                  </div>
                  <div>
                    <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
                      Last name
                    </label>
                    <input
                      type="text"
                      autoComplete="family-name"
                      required
                      maxLength={MAX_NAME_LENGTH}
                      value={lastName}
                      onChange={e => setLastName(e.target.value.replace(/\b\w/g, c => c.toUpperCase()))}
                      className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
                      placeholder="Smith"
                    />
                  </div>
                </div>

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

                <NewPasswordField
                  id="signup-password"
                  label="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />

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
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="text-teal-muted text-xs text-center mt-6">
                Already have an account?{' '}
                <Link to={buildAuthPath('/login', returnTo)} className="text-teal hover:text-white transition-colors">
                  Sign in
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
