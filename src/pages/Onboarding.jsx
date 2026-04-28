import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../providers/AuthProvider'
import { apiFetch } from '../utils/api'

export function Onboarding() {
  const navigate = useNavigate()
  const { addTeam } = useAuth()
  const [step, setStep] = useState('choose') // choose | create | join
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch('/teams', { method: 'POST', body: JSON.stringify({ name: teamName }) })
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

  const handleJoin = async e => {
    e.preventDefault()
    setLoading(true)
    // Accept full URL or bare token
    const token = inviteCode.trim().split('/').pop()
    try {
      const res = await apiFetch(`/teams/join/${token}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      addTeam({ id: data.id, name: data.name, role: data.role ?? 'member' })
      toast.success(`Joined "${data.name}"!`)
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <span className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">MeetIQ</span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Let's get you set up</p>
        </div>

        {step === 'choose' && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card-md p-7 space-y-4">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 text-center mb-2">How are you joining?</h1>

            <button onClick={() => setStep('create')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group text-left">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                🏢
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">I'm an Admin</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Create a new team and invite members</p>
              </div>
            </button>

            <button onClick={() => setStep('join')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group text-left">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                🔗
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">I'm a Member</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Join a team using an invite link</p>
              </div>
            </button>
          </div>
        )}

        {step === 'create' && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card-md p-7">
            <button onClick={() => setStep('choose')} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors mb-4 flex items-center gap-1">
              ← Back
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl mx-auto mb-2">🏢</div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create your team</h1>
              <p className="text-xs text-slate-500 mt-1">You'll be the admin — share the invite link to add members.</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Team Name</label>
                <input value={teamName} onChange={e => setTeamName(e.target.value)} required placeholder="e.g. Product Team, Acme Corp" autoFocus className={inputClass} />
              </div>
              <button type="submit" disabled={loading || !teamName.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md">
                {loading ? 'Creating…' : 'Create team'}
              </button>
            </form>
          </div>
        )}

        {step === 'join' && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card-md p-7">
            <button onClick={() => setStep('choose')} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors mb-4 flex items-center gap-1">
              ← Back
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl mx-auto mb-2">🔗</div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Join a team</h1>
              <p className="text-xs text-slate-500 mt-1">Paste the invite link your admin shared with you.</p>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Invite Link or Code</label>
                <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} required placeholder="https://… or paste the code" autoFocus className={inputClass} />
              </div>
              <button type="submit" disabled={loading || !inviteCode.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md">
                {loading ? 'Joining…' : 'Join team'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
