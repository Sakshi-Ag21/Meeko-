import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'

export function MeetingsLineChart({ data }) {
  const c = useChartColors()
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: c.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: c.tick, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: `1px solid ${c.tooltipBorder}`,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
              backgroundColor: c.tooltipBg,
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4, color: c.tooltipLabel }}
            itemStyle={{ color: c.tooltipLabel }}
          />
          <Line
            type="monotone"
            dataKey="meetings"
            name="Meetings"
            stroke="#1E3A8A"
            strokeWidth={2}
            dot={{ fill: '#1E3A8A', strokeWidth: 2, r: 4, stroke: c.dotStroke }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
