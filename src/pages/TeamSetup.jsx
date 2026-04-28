import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../providers/AuthProvider'
import { apiFetch } from '../utils/api'

// Create a new team
export function NewTeam() {
  const navigate = useNavigate()
  const { addTeam, teams } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch('/teams', { method: 'POST', body: JSON.stringify({ name }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addTeam({ id: data.id, name: data.name, invite_token: data.invite_token, role: data.role })
      toast.success(`Team "${data.name}" created!`)
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl mx-auto mb-3">🏢</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create your team</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All meeting data is isolated per team.</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card-md p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Team Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Product Team, Acme Corp" autoFocus
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
            <button type="submit" disabled={loading || !name.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md">
              {loading ? 'Creating…' : 'Create team'}
            </button>
          </form>

          {teams.length > 0 && (
            <button onClick={() => navigate('/')} className="w-full mt-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-center">
              ← Back to dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Join via invite link /teams/join/:token
export function JoinTeam() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { addTeam, refreshTeams, user } = useAuth()
  const [status, setStatus] = useState('joining') // joining | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) { navigate(`/login?next=/teams/join/${token}`); return }
    apiFetch(`/teams/join/${token}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('error'); setMessage(data.error); return }
        if (data.already) {
          setStatus('success'); setMessage(`You're already in "${data.name}".`)
          refreshTeams().then(() => setTimeout(() => navigate('/'), 1500))
          return
        }
        addTeam({ id: data.id, name: data.name, role: data.role })
        setStatus('success'); setMessage(`Joined "${data.name}" as ${data.role}!`)
        setTimeout(() => navigate('/'), 1500)
      })
      .catch(() => { setStatus('error'); setMessage('Failed to join team. The link may be invalid.') })
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        {status === 'joining' && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">Joining team…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl mx-auto">✓</div>
            <p className="text-slate-800 dark:text-slate-200 font-semibold">{message}</p>
            <p className="text-sm text-slate-500">Redirecting…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-2xl mx-auto">⚠️</div>
            <p className="text-rose-600 dark:text-rose-400 font-semibold">{message}</p>
            <button onClick={() => navigate('/')} className="text-sm text-indigo-600 hover:underline">Go to dashboard</button>
          </>
        )}
      </div>
    </div>
  )
}

// Team settings page /teams/:id/settings
export function TeamSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentTeam, refreshTeams, user } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const load = () => {
    apiFetch(`/teams/${id}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setTeam(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const inviteLink = team ? `${window.location.origin}/teams/join/${team.invite_token}` : ''

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const regenerate = async () => {
    setRegenerating(true)
    const res = await apiFetch(`/teams/${id}/invite/regenerate`, { method: 'POST' })
    const data = await res.json()
    if (data.invite_token) setTeam(prev => ({ ...prev, invite_token: data.invite_token }))
    setRegenerating(false)
    toast.success('Invite link regenerated.')
  }

  const changeRole = async (userId, role) => {
    const res = await apiFetch(`/teams/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) })
    if (res.ok) { load(); toast.success('Role updated.') }
    else toast.error('Failed to update role.')
  }

  const removeMember = async (userId, name) => {
    if (!confirm(`Remove ${name} from team?`)) return
    const res = await apiFetch(`/teams/${id}/members/${userId}`, { method: 'DELETE' })
    if (res.ok) { load(); refreshTeams(); toast.success(`${name} removed.`) }
    else { const d = await res.json(); toast.error(d.error) }
  }

  const leaveTeam = async () => {
    if (!confirm('Leave this team?')) return
    const res = await apiFetch(`/teams/${id}/members/${user.id}`, { method: 'DELETE' })
    if (res.ok) { await refreshTeams(); navigate('/'); toast.success('Left team.') }
    else { const d = await res.json(); toast.error(d.error) }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  )

  if (!team) return null
  const isAdmin = team.my_role === 'admin'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-4 flex items-center gap-1.5">
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{team.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Team settings · You are {isAdmin ? 'an admin' : 'a member'}</p>
        </div>

        {/* Invite link */}
        {isAdmin && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Invite link</h2>
            <p className="text-xs text-slate-400 mb-3">Anyone with this link can join as a member.</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink}
                className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-600 dark:text-slate-400 focus:outline-none" />
              <button onClick={copyInvite} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shrink-0">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button onClick={regenerate} disabled={regenerating} className="mt-2 text-xs text-slate-400 hover:text-rose-500 transition-colors">
              {regenerating ? 'Regenerating…' : '↺ Regenerate link (invalidates old one)'}
            </button>
          </div>
        )}

        {/* Members */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Members · {team.members.length}</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {team.members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {m.name} {m.id === user.id && <span className="text-xs text-slate-400">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && m.id !== user.id ? (
                    <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                      className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 focus:outline-none">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${m.role === 'admin' ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                      {m.role}
                    </span>
                  )}
                  {(isAdmin && m.id !== user.id) && (
                    <button onClick={() => removeMember(m.id, m.name)} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors text-xs">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave */}
        <div className="flex justify-end">
          <button onClick={leaveTeam} className="text-sm text-rose-600 dark:text-rose-400 hover:underline transition-colors">
            Leave team
          </button>
        </div>
      </div>
    </div>
  )
}
