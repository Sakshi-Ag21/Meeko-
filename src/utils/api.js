// Local dev: set VITE_API_URL=http://localhost:5001 in .env
// Vercel: leave unset — calls go to /api/* on the same domain
const API_URL = import.meta.env.VITE_API_URL ?? '/api'

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const teamId = localStorage.getItem('teamId')

  const headers = {
    ...(options.body && !options.headers?.['Content-Type'] && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(teamId && { 'X-Team-Id': teamId }),
    ...options.headers,
  }

  return fetch(`${API_URL}${path}`, { ...options, headers })
}
