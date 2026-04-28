import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'

export function ContributionBarChart({ data }) {
  const c = useChartColors()
  const chartData = data.map((p) => ({
    name: p.name.split(' ')[0],
    fullName: p.name.trim(),
    contribution: p.contributionPct,
  }))

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal vertical={false} />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tick={{ fill: c.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={72}
            tick={{ fill: c.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Contribution']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
            contentStyle={{
              borderRadius: '12px',
              border: `1px solid ${c.tooltipBorder}`,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
              backgroundColor: c.tooltipBg,
            }}
            labelStyle={{ color: c.tooltipLabel }}
            itemStyle={{ color: c.tooltipLabel }}
          />
          <Bar dataKey="contribution" name="Contribution %" fill="#1E3A8A" radius={[0, 8, 8, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
