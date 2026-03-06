import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const data = [
  { name: 'M', value: 1200 },
  { name: 'T', value: 1800 },
  { name: 'W', value: 1100 },
  { name: 'T', value: 2400 },
  { name: 'F', value: 2600 },
  { name: 'S', value: 3200 },
  { name: 'S', value: 800 },
  { name: 'M', value: 2100 },
  { name: 'T', value: 1500 },
  { name: 'W', value: 2800 },
  { name: 'T', value: 3000 },
  { name: 'F', value: 2100 },
  { name: 'S', value: 1900 },
  { name: 'S', value: 1800 },
];

const pieData = [
  { name: 'Tops', value: 40 },
  { name: 'Bottoms', value: 25 },
  { name: 'Accessories', value: 15 },
  { name: 'Other', value: 10 },
];

const COLORS = ['#2C5234', '#557B5A', '#A3B8A6', '#E5E5E0'];

export default function AdminAnalytics() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Last 30 days — updated today</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            Last 30 days
          </Button>
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">Revenue</div>
          <div className="text-3xl font-serif font-medium mb-2">$48,290</div>
          <div className="flex items-center text-sm font-medium text-[#2C5234] dark:text-green-400">
            <ArrowUp className="w-3 h-3 mr-1" /> 12.4% vs last month
          </div>
        </div>
        
        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">Orders</div>
          <div className="text-3xl font-serif font-medium mb-2">384</div>
          <div className="flex items-center text-sm font-medium text-[#2C5234] dark:text-green-400">
            <ArrowUp className="w-3 h-3 mr-1" /> 8.1% vs last month
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">Avg. Order Value</div>
          <div className="text-3xl font-serif font-medium mb-2">$125.76</div>
          <div className="flex items-center text-sm font-medium text-[#2C5234] dark:text-green-400">
            <ArrowUp className="w-3 h-3 mr-1" /> 3.9% vs last month
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">New Customers</div>
          <div className="text-3xl font-serif font-medium mb-2">61</div>
          <div className="flex items-center text-sm font-medium text-[#9A2D2D] dark:text-red-400">
            <ArrowDown className="w-3 h-3 mr-1" /> 2.2% vs last month
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6 lg:col-span-2">
          <h3 className="font-serif font-medium text-lg mb-1">Revenue Over Time</h3>
          <p className="text-sm text-muted-foreground mb-6">Daily revenue for the past 30 days</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#557B5A" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-6">
          <h3 className="font-serif font-medium text-lg mb-1">Sales by Category</h3>
          <p className="text-sm text-muted-foreground mb-6">Revenue share this period</p>
          <div className="h-40 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <span className="font-medium">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}