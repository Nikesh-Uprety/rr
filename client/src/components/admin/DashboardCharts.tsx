import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Package, TrendingUp } from "lucide-react";

import type { AdminAnalytics } from "@/lib/adminApi";

export function DashboardCharts({ analytics }: { analytics?: AdminAnalytics }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue Trend (Last 7 Days)
            </h2>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics?.revenueByDay || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&_line]:stroke-border" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground"
                tickFormatter={(str) => {
                  const date = new Date(str);
                  return date.toLocaleDateString('en-NP', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground" />
              <Tooltip
                cursor={{ fill: 'rgba(128,128,128,0.1)' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={32}>
                {(analytics?.revenueByDay || []).map((_, index) => (
                  <Cell key={`rev-${index}`} className="fill-[#4ADE80] dark:fill-[#4ADE80]" fill="#2C3E2D" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              Sales by Category
            </h2>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics?.salesByCategory || []}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="[&_line]:stroke-border" />
              <XAxis type="number" hide />
              <YAxis
                dataKey="category"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                width={80}
                className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground"
              />
              <Tooltip
                cursor={{ fill: 'rgba(128,128,128,0.1)' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                {(analytics?.salesByCategory || []).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={['#4ADE80', '#34D399', '#22C55E', '#16A34A', '#15803D'][index % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
