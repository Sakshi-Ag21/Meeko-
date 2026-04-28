import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from './providers/ThemeProvider'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { MeetingDetail } from './pages/MeetingDetail'
import { Analytics } from './pages/Analytics'
import { TeamSummary } from './pages/TeamSummary'
import { AskAI } from './pages/AskAI'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { NewTeam, JoinTeam, TeamSettings } from './pages/TeamSetup'
import { Onboarding } from './pages/Onboarding'

function AppToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      theme={theme}
      toastOptions={{ classNames: { toast: 'font-sans' } }}
    />
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/teams/join/:token" element={<JoinTeam />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/analyze" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/meetings/:id" element={<ProtectedRoute><MeetingDetail /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/team-summary" element={<ProtectedRoute><TeamSummary /></ProtectedRoute>} />
      <Route path="/ask-ai" element={<ProtectedRoute><AskAI /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/teams/new" element={<ProtectedRoute><NewTeam /></ProtectedRoute>} />
      <Route path="/teams/:id/settings" element={<ProtectedRoute><TeamSettings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppToaster />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
