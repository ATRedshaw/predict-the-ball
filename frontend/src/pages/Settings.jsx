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
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [profileMsg,  setProfileMsg]  = useState(null)   // { type: 'ok'|'err', text }
  const [profileBusy, setProfileBusy] = useState(false)

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

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const me = await api.get('/api/auth/me')
        setFirstName(me.first_name)
        setLastName(me.last_name)
        setEmail(me.email)
      } catch {
        // If something goes wrong the fields just stay blank
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileMsg(null)
    setProfileBusy(true)
    try {
      const updated = await api.put('/api/users/me', {
        first_name: firstName,
        last_name:  lastName,
      })
      setFirstName(updated.first_name)
      setLastName(updated.last_name)
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
      })
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

    setDeleteBusy(true)
    try {
      await api.delete('/api/users/me')
      localStorage.removeItem('access_token')
      localStorage.removeItem('first_name')
      navigate('/')
    } catch (err) {
      setDeleteMsg({ type: 'err', text: err.message })
      setDeleteBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto w-full py-4 space-y-4">

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
              disabled={profileBusy}
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
              disabled={passwordBusy}
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
        description="This is permanent. All your predictions and league memberships will be removed."
      >
        <form onSubmit={handleDeleteAccount} className="space-y-4">
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
