// Isolated recharts entry point so the recharts bundle is only fetched
// when the dashboard's revenue chart actually renders (React.lazy).
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export type RevenuePoint = { d: string; total: number };

export default function RevenueAreaChart({
  data,
  formatValue,
}: {
  data: RevenuePoint[];
  formatValue: (v: number) => string;
}) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dash-rev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
        <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
        <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
        <Tooltip formatter={(v: number) => formatValue(v)} />
        <Area type="monotone" dataKey="total" stroke="oklch(0.42 0.08 250)" fill="url(#dash-rev)" name="Revenue" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
