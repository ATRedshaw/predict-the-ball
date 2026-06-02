import { useState, useEffect, useLayoutEffect } from 'react'
import { api } from '../api'
import { usePageLoading } from '../components/PageLoadingContext'

// ─── Tiny shared components ────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div className="bg-jet-dark rounded-2xl p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-white font-semibold text-base">{title}</h2>
        {description && <p className="text-teal-muted text-xs mt-1">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Feedback({ type, text }) {
  const ok = type === 'ok'
  return (
    <p className={`text-xs rounded-xl px-4 py-3 border ${
      ok ? 'text-teal bg-teal/10 border-teal/20' : 'text-red-400 bg-red-400/10 border-red-400/20'
    }`}>
      {text}
    </p>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const { setPageLoading } = usePageLoading()

  const [season,  setSeason]  = useState(null)
  const [users,   setUsers]   = useState([])
  const [deductions, setDeductions] = useState([])

  // Deduction form
  const [team,   setTeam]   = useState('')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [dedMsg, setDedMsg] = useState(null)
  const [dedBusy, setDedBusy] = useState(false)

  // Refresh standings
  const [refreshMsg,  setRefreshMsg]  = useState(null)
  const [refreshBusy, setRefreshBusy] = useState(false)

  // Users search
  const [userSearch, setUserSearch] = useState('')

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [{ season: s }, userList] = await Promise.all([
          api.get('/api/standings/current-season'),
          api.get('/api/admin/users'),
        ])
        setSeason(s)
        setUsers(userList)
        const deds = await api.get(`/api/standings/${s}/deductions`)
        setDeductions(deds)
      } catch {
        // Non-fatal
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  async function handleAddDeduction(e) {
    e.preventDefault()
    setDedMsg(null)

    const pts = parseInt(points, 10)
    if (!team.trim()) {
      setDedMsg({ type: 'err', text: 'Team name is required.' })
      return
    }
    if (!Number.isInteger(pts) || pts <= 0) {
      setDedMsg({ type: 'err', text: 'Points must be a positive integer.' })
      return
    }

    setDedBusy(true)
    try {
      const added = await api.post(`/api/standings/${season}/deductions`, {
        team: team.trim(),
        points: pts,
        reason: reason.trim() || undefined,
      })
      setDeductions(prev => [added, ...prev])
      setTeam('')
      setPoints('')
      setReason('')
      setDedMsg({ type: 'ok', text: 'Deduction added.' })
    } catch (err) {
      setDedMsg({ type: 'err', text: err.message })
    } finally {
      setDedBusy(false)
    }
  }

  async function handleRemoveDeduction(id) {
    try {
      await api.delete(`/api/standings/${season}/deductions/${id}`)
      setDeductions(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      setDedMsg({ type: 'err', text: err.message })
    }
  }

  async function handleRefresh() {
    setRefreshMsg(null)
    setRefreshBusy(true)
    try {
      const res = await api.post('/api/admin/standings/refresh', {})
      setRefreshMsg({ type: 'ok', text: res.message })
    } catch (err) {
      setRefreshMsg({ type: 'err', text: err.message })
    } finally {
      setRefreshBusy(false)
    }
  }

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return (
      !q ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-5xl mx-auto w-full py-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Admin panel</h1>
          {season && <p className="text-teal-muted text-xs mt-1">Season {season}</p>}
        </div>
        <span className="bg-teal/20 text-teal text-xs font-medium px-3 py-1 rounded-full">
          Admin
        </span>
      </div>

      {/* ── Standings refresh ── */}
      <Section
        title="Refresh standings"
        description="Recalculate the current EPL table from CSV data, update prediction scores, and run the ELO simulation."
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshBusy}
            className="bg-teal text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshBusy ? 'Refreshing…' : 'Run refresh'}
          </button>
          {refreshMsg && <Feedback type={refreshMsg.type} text={refreshMsg.text} />}
        </div>
      </Section>

      {/* ── Points deductions ── */}
      <Section
        title="Points deductions"
        description={`Deductions applied to the ${season ?? '—'} season. Changes take effect on the next standings refresh.`}
      >
        {/* Existing deductions */}
        {deductions.length > 0 ? (
          <div className="space-y-2 mb-6">
            {deductions.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-jet rounded-xl px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{d.team}</span>
                    <span className="text-red-400 text-xs font-mono">−{d.points} pts</span>
                  </div>
                  {d.reason && <p className="text-teal-muted text-xs mt-0.5 truncate">{d.reason}</p>}
                  <p className="text-white/30 text-xs mt-0.5">
                    {new Date(d.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveDeduction(d.id)}
                  className="text-red-400/60 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-xs mb-6">No deductions applied this season.</p>
        )}

        {/* Add deduction form */}
        <form onSubmit={handleAddDeduction} className="space-y-3">
          <p className="text-teal-muted text-xs uppercase tracking-widest">Add deduction</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Team name (exact)"
              value={team}
              onChange={e => setTeam(e.target.value)}
              className="bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
            />
            <input
              type="number"
              min="1"
              placeholder="Points"
              value={points}
              onChange={e => setPoints(e.target.value)}
              className="bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors"
            />
          </div>
          {dedMsg && <Feedback type={dedMsg.type} text={dedMsg.text} />}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={dedBusy || !team || !points}
              className="bg-teal text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dedBusy ? 'Adding…' : 'Add deduction'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Users ── */}
      <Section
        title={`Users (${users.length})`}
        description="All registered accounts. Predictions are never shown here."
      >
        <input
          type="text"
          placeholder="Search by name or email…"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="w-full bg-jet rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-transparent focus:border-teal transition-colors mb-4"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="text-teal-muted text-xs font-medium uppercase tracking-widest pb-3 pr-4">Name</th>
                <th className="text-teal-muted text-xs font-medium uppercase tracking-widest pb-3 pr-4">Email</th>
                <th className="text-teal-muted text-xs font-medium uppercase tracking-widest pb-3 pr-4">Verified</th>
                <th className="text-teal-muted text-xs font-medium uppercase tracking-widest pb-3 pr-4">Role</th>
                <th className="text-teal-muted text-xs font-medium uppercase tracking-widest pb-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 text-white">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="py-3 pr-4 text-teal-muted font-mono text-xs">{u.email}</td>
                  <td className="py-3 pr-4">
                    {u.is_verified
                      ? <span className="text-teal text-xs">Yes</span>
                      : <span className="text-white/30 text-xs">No</span>
                    }
                  </td>
                  <td className="py-3 pr-4">
                    {u.is_admin
                      ? <span className="bg-teal/20 text-teal text-xs px-2 py-0.5 rounded-full">Admin</span>
                      : <span className="text-white/40 text-xs">User</span>
                    }
                  </td>
                  <td className="py-3 text-white/40 text-xs">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/30 text-xs">No users match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  )
}
