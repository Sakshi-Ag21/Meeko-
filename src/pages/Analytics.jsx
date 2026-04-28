import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { Navbar } from '../components/Navbar'
import { speakerColor } from '../utils/speakerColor'
import { apiFetch } from '../utils/api'

// Format "2026-04-09" → "Apr 9"
function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COLORS = ['#6366f1','#8b5cf6','#10b981','#f43f5e','#f59e0b','#06b6d4','#ec4899','#14b8a6']
function barColor(name) {
  return COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]
}

const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }
const stagger = { show: { transition: { staggerChildren: 0.08 } } }

function StatCard({ icon, label, value, accent }) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-card-md transition-shadow"
    >
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <span className={`text-3xl font-bold tabular-nums ${accent ?? 'text-slate-800 dark:text-slate-100'}`}>
          {value ?? '—'}
        </span>
        <span className="text-2xl leading-none">{icon}</span>
      </div>
    </motion.div>
  )
}

function ChartCard({ title, icon, children }) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.stroke || p.fill }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  )
}

function PeopleChart({ data, valueKey, label }) {
  if (!data?.length) return <p className="text-sm text-slate-400 italic text-center py-6">No data yet.</p>
  const h = Math.max(data.length * 38 + 40, 100)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 44, top: 2, bottom: 2 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
        <Bar dataKey={valueKey} name={label} radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map(d => <Cell key={d.name} fill={barColor(d.name)} />)}
          <LabelList dataKey={valueKey} position="right" style={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function SkeletonCard({ h = 'h-40' }) {
  return (
    <div className={`${h} rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse`} />
  )
}

export function Analytics() {
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch('/analytics').then(r => r.json()),
      apiFetch('/stats').then(r => r.json()),
    ])
      .then(([a, s]) => { setData(a); setStats(s) })
      .finally(() => setLoading(false))
  }, [])

  const dateData = (data?.byDate ?? []).map(d => ({ ...d, label: fmtDate(d.date) }))
  const topParticipant = data?.byParticipant?.[0]
  const topAction = data?.byActions?.[0]
  const totalActions = (data?.byActions ?? []).reduce((s, d) => s + d.count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Team Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Across all saved meetings and participants</p>
        </motion.div>

        {/* KPI row */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <SkeletonCard key={i} h="h-24" />)}
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <StatCard icon="📋" label="Total Meetings" value={stats?.totalMeetings} accent="text-indigo-600 dark:text-indigo-400" />
            <StatCard icon="👥" label="Participants" value={stats?.uniqueParticipants} accent="text-violet-600 dark:text-violet-400" />
            <StatCard icon="📅" label="This Month" value={stats?.thisMonth} accent="text-emerald-600 dark:text-emerald-400" />
            <StatCard icon="✅" label="Action Items" value={totalActions} accent="text-amber-600 dark:text-amber-400" />
          </motion.div>
        )}

        {/* Meetings over time — by actual meeting date */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} style={{ transitionDelay: '0.1s' }}>
          <ChartCard icon="📈" title="Meetings Over Time">
            {loading ? <SkeletonCard h="h-52" /> : dateData.length === 0 ? (
              <p className="text-center text-sm text-slate-400 italic py-10">No meetings yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dateData} margin={{ left: -12, right: 8, top: 10, bottom: 4 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    interval={dateData.length > 10 ? Math.floor(dateData.length / 8) : 0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="meetings"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#areaGrad)"
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </motion.div>

        {/* Side-by-side people charts */}
        <motion.div initial="hidden" animate="show" variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <ChartCard icon="🧑‍🤝‍🧑" title="Meetings per Participant">
            {loading ? <SkeletonCard h="h-48" /> : (
              <>
                {topParticipant && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Most active: <span className="font-semibold text-slate-700 dark:text-slate-200">{topParticipant.name}</span>
                    {' '}<span className="text-slate-400">({topParticipant.meetings} meetings)</span>
                  </p>
                )}
                <PeopleChart data={data?.byParticipant ?? []} valueKey="meetings" label="meetings" />
              </>
            )}
          </ChartCard>

          <ChartCard icon="✅" title="Action Items per Participant">
            {loading ? <SkeletonCard h="h-48" /> : (
              <>
                {topAction && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Most assigned: <span className="font-semibold text-slate-700 dark:text-slate-200">{topAction.name}</span>
                    {' '}<span className="text-slate-400">({topAction.count} items)</span>
                  </p>
                )}
                <PeopleChart data={data?.byActions ?? []} valueKey="count" label="action items" />
              </>
            )}
          </ChartCard>
        </motion.div>

        {/* Breakdown table */}
        {!loading && (data?.byParticipant?.length ?? 0) > 0 && (
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <ChartCard icon="📊" title="Participant Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {['Participant','Meetings','Action Items','Avg / Meeting'].map(h => (
                        <th key={h} className={`py-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ${h === 'Participant' ? 'text-left pr-4' : 'text-right pr-4 last:pr-0'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byParticipant ?? []).map((p, i) => {
                      const actions = (data?.byActions ?? []).find(a => a.name === p.name)?.count ?? 0
                      const avg = p.meetings > 0 ? (actions / p.meetings).toFixed(1) : '0'
                      return (
                        <motion.tr
                          key={p.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${speakerColor(p.name)}`}>
                                {p.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">{p.meetings}</td>
                          <td className="py-3 pr-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{actions}</td>
                          <td className="py-3 text-right tabular-nums text-slate-400 dark:text-slate-500">{avg}</td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </motion.div>
        )}

      </main>
    </div>
  )
}
