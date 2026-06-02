import { useState, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { usePageLoading } from '../components/PageLoadingContext'

// ─── Small reusable section wrapper ───────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div className="bg-jet-dark rounded-2xl p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-white font-semibold text-base">{title}</h2>
        {description && (
          <p className="text-teal-muted text-xs mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Inline field ──────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-teal-muted text-xs uppercase tracking-widest mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate()
  const { setPageLoading } = usePageLoading()

  // Profile state
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [savedFirstName, setSavedFirstName] = useState('')
  const [savedLastName,  setSavedLastName]  = useState('')
  const [profileMsg,  setProfileMsg]  = useState(null)   // { type: 'ok'|'err', text }
  const [profileBusy, setProfileBusy] = useState(false)

  const profileChanged = firstName !== savedFirstName || lastName !== savedLastName

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg,  setPasswordMsg]  = useState(null)
  const [passwordBusy, setPasswordBusy] = useState(false)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg,  setDeleteMsg]  = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // ownedLeagues: [{ id, name, season, other_members: [{ user_id, name }] }]
  const [ownedLeagues, setOwnedLeagues] = useState([])
  // transfers: { [leagueId]: userId | '' }  — '' means "delete this league"
  const [transfers, setTransfers] = useState({})

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [me, leagues] = await Promise.all([
          api.get('/api/auth/me'),
          api.get('/api/auth/me/owned-leagues'),
        ])
        setFirstName(me.first_name)
        setLastName(me.last_name)
        setEmail(me.email)
        setSavedFirstName(me.first_name)
        setSavedLastName(me.last_name)
        setOwnedLeagues(leagues)
        // Default every owned league to "delete" (empty string)
        const defaults = {}
        leagues.forEach(l => { defaults[l.id] = '' })
        setTransfers(defaults)
      } catch {
        // Non-fatal — fields stay blank
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout', {})
    } catch {
      // Token may already be invalid — clear it regardless
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('first_name')
    localStorage.removeItem('is_admin')
    navigate('/')
  }

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileMsg(null)
    setProfileBusy(true)
    try {
      const updated = await api.put('/api/auth/me', {
        first_name: firstName,
        last_name:  lastName,
      })
      setFirstName(updated.first_name)
      setLastName(updated.last_name)
      setSavedFirstName(updated.first_name)
      setSavedLastName(updated.last_name)
      localStorage.setItem('first_name', updated.first_name)
      setProfileMsg({ type: 'ok', text: 'Profile updated.' })
    } catch (err) {
      setProfileMsg({ type: 'err', text: err.message })
    } finally {
      setProfileBusy(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'err', text: 'New password must be at least 8 characters.' })
      return
    }

    setPasswordBusy(true)
    try {
      await api.post('/api/auth/reset-password', {
        current_password: currentPassword,
        new_password:     newPassword,
      }, true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'ok', text: 'Password updated.' })
    } catch (err) {
      setPasswordMsg({ type: 'err', text: err.message })
    } finally {
      setPasswordBusy(false)
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault()
    setDeleteMsg(null)

    if (deleteConfirm !== 'DELETE') {
      setDeleteMsg({ type: 'err', text: 'Type DELETE exactly to confirm.' })
      return
    }

    // Build transfer map — only include leagues where the user chose a recipient.
    // Leagues left as '' are sent as null (backend will delete them).
    const transferMap = {}
    ownedLeagues.forEach(l => {
      transferMap[l.id] = transfers[l.id] ? parseInt(transfers[l.id], 10) : null
    })

    setDeleteBusy(true)
    try {
      await api.delete('/api/auth/me', { transfers: transferMap })
      localStorage.removeItem('access_token')
      localStorage.removeItem('first_name')
      localStorage.removeItem('is_admin')
      navigate('/')
    } catch (err) {
      setDeleteMsg({ type: 'err', text: err.message })
      setDeleteBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto w-full py-4 space-y-4">

      {/* ── Log out ── */}
      <div className="flex justify-end">
        <button
          onClick={handleLogout}
          className="border border-white/20 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
        >
          Log out
        </button>
      </div>

      {/* ── Profile ── */}
      <Section
        title="Profile"
        description="Update how your name appears to others in leagues."
      >
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              type="email"
              readOnly
              value={email}
              className="w-full bg-jet/50 rounded-xl px-4 py-3 text-white/40 text-sm outline-none cursor-not-allowed"
            />
          </Field>

          {profileMsg && (
            <Feedback type={profileMsg.type} text={profileMsg.text} />
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileBusy || !profileChanged}
              className="bg-teal text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileBusy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Password ── */}
      <Section
        title="Change password"
        description="Must be at least 8 characters."
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="Current password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
              placeholder="••••••••"
            />
          </Field>

          <Field label="New password">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
              placeholder="••••••••"
            />
          </Field>

          <Field label="Confirm new password">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
              placeholder="••••••••"
            />
          </Field>

          {passwordMsg && (
            <Feedback type={passwordMsg.type} text={passwordMsg.text} />
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
              className="bg-teal text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Danger zone ── */}
      <Section
        title="Delete account"
        description="This is permanent. Your predictions and league memberships will be removed."
      >
        <form onSubmit={handleDeleteAccount} className="space-y-5">

          {/* Owned league transfer cards */}
          {ownedLeagues.length > 0 && (
            <div className="space-y-3">
              <p className="text-teal-muted text-xs uppercase tracking-widest">
                You own {ownedLeagues.length} {ownedLeagues.length === 1 ? 'league' : 'leagues'}
              </p>
              {ownedLeagues.map(league => (
                <div key={league.id} className="bg-jet rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{league.name}</p>
                    <p className="text-teal-muted text-xs mt-0.5">{league.season}</p>
                  </div>
                  <select
                    value={transfers[league.id] ?? ''}
                    onChange={e => setTransfers(prev => ({ ...prev, [league.id]: e.target.value }))}
                    className="bg-jet-dark text-white text-xs rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-teal transition-colors shrink-0"
                  >
                    <option value="">Delete this league</option>
                    {league.other_members.length > 0 && (
                      <optgroup label="Transfer ownership to">
                        {league.other_members.map(m => {
                          const atLimit = m.owned_count >= 10
                          return (
                            <option key={m.user_id} value={m.user_id} disabled={atLimit}>
                              {m.name}{atLimit ? ' (at ownership limit)' : ''}
                            </option>
                          )
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>
              ))}
            </div>
          )}

          <Field label='Type "DELETE" to confirm'>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-red-500 transition-colors"
              placeholder="DELETE"
            />
          </Field>

          {deleteMsg && (
            <Feedback type={deleteMsg.type} text={deleteMsg.text} />
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={deleteBusy || deleteConfirm !== 'DELETE'}
              className="bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteBusy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </Section>

    </div>
  )
}

// ─── Tiny feedback banner ──────────────────────────────────────────────────────

function Feedback({ type, text }) {
  const isOk = type === 'ok'
  return (
    <p className={`text-xs rounded-xl px-4 py-3 border ${
      isOk
        ? 'text-teal bg-teal/10 border-teal/20'
        : 'text-red-400 bg-red-400/10 border-red-400/20'
    }`}>
      {text}
    </p>
  )
}
