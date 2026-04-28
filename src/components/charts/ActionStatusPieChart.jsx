import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'

export function ActionStatusPieChart({ data }) {
  const c = useChartColors()
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={96}
            paddingAngle={3}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke={c.pieSegmentStroke} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: `1px solid ${c.tooltipBorder}`,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
              backgroundColor: c.tooltipBg,
            }}
            labelStyle={{ color: c.tooltipLabel, fontWeight: 600 }}
            itemStyle={{ color: c.tooltipLabel }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
