import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [teams, setTeams] = useState([])
  const [currentTeam, setCurrentTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    try {
      const res = await apiFetch('/auth/me')
      if (!res.ok) { localStorage.removeItem('token'); setLoading(false); return }
      const data = await res.json()
      setUser(data.user)
      setTeams(data.teams ?? [])

      // Restore last-used team
      const savedTeamId = localStorage.getItem('teamId')
      const match = data.teams.find(t => t.id === savedTeamId)
      const active = match ?? data.teams[0] ?? null
      setCurrentTeam(active)
      if (active) localStorage.setItem('teamId', active.id)
    } catch {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  const login = (token, userData, teamsData) => {
    localStorage.setItem('token', token)
    setUser(userData)
    setTeams(teamsData ?? [])
    const first = teamsData?.[0] ?? null
    setCurrentTeam(first)
    if (first) localStorage.setItem('teamId', first.id)
    else localStorage.removeItem('teamId')
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('teamId')
    setUser(null)
    setTeams([])
    setCurrentTeam(null)
  }

  const switchTeam = (team) => {
    setCurrentTeam(team)
    localStorage.setItem('teamId', team.id)
  }

  const addTeam = (team) => {
    setTeams(prev => [...prev, team])
    switchTeam(team)
  }

  const refreshTeams = async () => {
    try {
      const res = await apiFetch('/auth/me')
      if (res.ok) {
        const data = await res.json()
        setTeams(data.teams ?? [])
        // keep current team if still a member
        const still = data.teams.find(t => t.id === currentTeam?.id)
        if (!still) {
          const first = data.teams[0] ?? null
          setCurrentTeam(first)
          if (first) localStorage.setItem('teamId', first.id)
          else localStorage.removeItem('teamId')
        }
      }
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, teams, currentTeam, loading, login, logout, switchTeam, addTeam, refreshTeams }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
