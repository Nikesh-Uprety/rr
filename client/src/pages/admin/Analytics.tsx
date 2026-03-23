/**
 * AdminAnalytics.tsx — RARE.NP "Antigravity" redesign
 * Requires: Syne + DM Mono fonts in index.html, --ag-* CSS vars in index.css
 * Dark mode: toggled via .dark class on <html> (Tailwind darkMode: 'class')
 */

import { ExportButton } from "@/components/admin/ExportButton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deletePlatform,
  exportAnalyticsCSV,
  fetchAnalytics,
  fetchAnalyticsCalendar,
  fetchPlatforms,
  upsertPlatform,
  type AdminAnalytics,
  type AdminAnalyticsCalendarDay,
  type AdminPlatform,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type RangeKey = "7d" | "30d" | "90d" | "1y";
type CalendarView = "year" | "month";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
};

const PAYMENT_LABELS: Record<string, string> = {
  esewa: "eSewa",
  cash_on_delivery: "COD",
  card: "Card",
  bank_transfer: "Bank",
};

const COLOR_TOKENS = {
  emerald: "var(--ag-green-m)",
  amber: "var(--ag-amber)",
  blue: "var(--ag-blue)",
  purple: "var(--ag-purple)",
  red: "hsl(var(--destructive))",
  border: "hsl(var(--border))",
  muted: "hsl(var(--muted-foreground))",
  heatLow: "var(--ag-green-l)",
  heatMedium: "var(--ag-green-m)",
  heatHigh: "var(--ag-green)",
  heatPeak: "hsl(var(--primary))",
};

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSafeNum(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]+/g,"");
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function formatTrend(value: number): { label: string; isPositive: boolean } {
  const val = toSafeNum(value);
  if (!Number.isFinite(val) || val === 0)
    return { label: "0%", isPositive: true };
  const rounded = Math.round(val);
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
    isPositive: rounded >= 0,
  };
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────

const AgTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-card border border-border rounded-xl p-3 shadow-xl admin-font text-[11px] text-foreground"
    >
      {label && (
        <div className="text-muted-foreground mb-1 font-bold">{label}</div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="mb-0.5" style={{ color: p.color ?? "inherit" }}>
          {formatter ? formatter(p) : `${p.name}: ${p.value}`}
        </div>
      ))}
    </div>
  );
};

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useAnalytics(range: RangeKey) {
  return useQuery<AdminAnalytics>({
    queryKey: ["admin", "analytics", range],
    queryFn: () => fetchAnalytics(range),
  });
}

function useAnalyticsCalendar(year: number) {
  return useQuery<AdminAnalyticsCalendarDay[]>({
    queryKey: ["admin", "analytics", "calendar", year],
    queryFn: () => fetchAnalyticsCalendar(year),
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skel = ({ w = "100%", h = 16 }: { w?: string | number; h?: number }) => (
  <div
    className="animate-pulse rounded-lg bg-muted"
    style={{ width: w, height: h }}
  />
);

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyles = "bg-card border border-border rounded-2xl p-6 relative overflow-hidden shadow-sm";

const monoLabelStyles = "text-[10px] tracking-[0.2em] text-muted-foreground uppercase block mb-1 font-black";

const sectionTitleStyles = "text-xs font-black text-foreground uppercase tracking-widest mb-4";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPI_ACCENT: Record<number, string> = {
  0: COLOR_TOKENS.emerald,
  1: COLOR_TOKENS.amber,
  2: COLOR_TOKENS.blue,
  3: COLOR_TOKENS.purple,
};

function KpiCard({
  label, value, trend, subtitle, sparkData, idx, isLoading,
}: {
  label: string; value: string; trend: number; subtitle: string;
  sparkData: number[]; idx: number; isLoading: boolean;
}) {
  const trendInfo = formatTrend(trend);
  const TrendIcon = trendInfo.isPositive ? ArrowUpRight : ArrowDownRight;
  const accent = KPI_ACCENT[idx];
  const sparkColor = accent;

  return (
    <div className={cardStyles} style={{ borderTop: `4px solid ${accent}` }}>
      {isLoading ? (
        <div className="space-y-3">
          <Skel w={80} h={10} />
          <Skel w={120} h={28} />
          <Skel w={90} h={10} />
        </div>
      ) : (
        <>
          <span className={monoLabelStyles}>{label}</span>
          <div className="text-3xl font-black tracking-tight text-foreground my-2 leading-none">
            {value}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] font-black inline-flex items-center gap-1 px-2 py-0.5 rounded-full uppercase tracking-wider",
              trendInfo.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
              <TrendIcon size={10} />
              {trendInfo.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {subtitle}
            </span>
          </div>
          <div className="mt-4 -mx-6 -mb-6">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={sparkData.map((v) => ({ v }))}>
                <defs>
                  <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={sparkColor} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={sparkColor} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v"
                  stroke={sparkColor} strokeWidth={2}
                  fill={`url(#spark-${idx})`} dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data, isLoading } = useAnalytics(range);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<CalendarView>("year");
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const { data: calendar, isLoading: isCalendarLoading } = useAnalyticsCalendar(calendarYear);

  const queryClient = useQueryClient();
  const { data: platforms = [] } = useQuery<AdminPlatform[]>({
    queryKey: ["admin", "platforms"],
    queryFn: fetchPlatforms,
  });
  const upsertPlatformMutation = useMutation({
    mutationFn: upsertPlatform,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "platforms"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
    },
  });
  const deletePlatformMutation = useMutation({
    mutationFn: deletePlatform,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "platforms"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
    },
  });
  const [newPlatformKey, setNewPlatformKey] = useState("");
  const [newPlatformLabel, setNewPlatformLabel] = useState("");

  // ── Derived data ─────────────────────────────────────────────────────────

  const combinedByDay = useMemo(() => {
    const revenueByDate = new Map((data?.revenueByDay ?? []).map((d) => [d.date, toSafeNum(d.revenue)] as const));
    const ordersByDate  = new Map((data?.ordersByDay   ?? []).map((d) => [d.date, toSafeNum(d.count)]   as const));
    const custByDate    = new Map((data?.newCustomersByDay ?? []).map((d) => [d.date, toSafeNum(d.count)] as const));
    const allDates = Array.from(new Set([
      ...(data?.revenueByDay ?? []).map((d) => d.date),
      ...(data?.ordersByDay  ?? []).map((d) => d.date),
      ...(data?.newCustomersByDay ?? []).map((d) => d.date),
    ])).sort();
    return allDates.map((date) => {
      const revenue = revenueByDate.get(date) ?? 0;
      const orders  = ordersByDate.get(date)  ?? 0;
      const newCustomers = custByDate.get(date) ?? 0;
      return { date, label: date.slice(5), revenue, orders, newCustomers, aov: orders > 0 ? revenue / orders : 0 };
    });
  }, [data]);

  const ordersStatusData = useMemo(() => {
    if (!data) return [];
    return [
      { status: "Completed", key: "completed", value: toSafeNum(data.ordersByStatus.completed), color: COLOR_TOKENS.emerald, hex: COLOR_TOKENS.emerald },
      { status: "Pending",   key: "pending",   value: toSafeNum(data.ordersByStatus.pending),   color: COLOR_TOKENS.amber, hex: COLOR_TOKENS.amber },
      { status: "Cancelled", key: "cancelled", value: toSafeNum(data.ordersByStatus.cancelled), color: COLOR_TOKENS.red, hex: COLOR_TOKENS.red },
    ];
  }, [data]);

  const paymentMethodsData = useMemo(() => {
    if (!data) return [];
    return data.paymentMethods.map((m) => ({
      method: PAYMENT_LABELS[m.method] ?? m.method,
      count: toSafeNum(m.count), percent: toSafeNum(m.percent),
    }));
  }, [data]);

  const ordersByDayOfWeekData = useMemo(
    () => data?.ordersByDayOfWeek.map((d) => ({ day: d.day, count: toSafeNum(d.count) })) ?? [],
    [data],
  );

  // ── Calendar ────────────────────────────────────────────────────────────

  const calendarLayout = useMemo(() => {
    if (!calendar || calendar.length === 0) return null;
    const startDate = new Date(calendar[0].date);
    const getWeekIndex = (date: Date) =>
      Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const cells = calendar.map((day) => {
      const dateObj = new Date(day.date);
      return { ...day, revenue: toSafeNum(day.revenue), weekIndex: getWeekIndex(dateObj), weekday: (dateObj.getDay() + 6) % 7 };
    });
    const weeksCount = cells.length > 0 ? Math.max(...cells.map((c) => c.weekIndex)) + 1 : 0;
    const monthLabels: { weekIndex: number; label: string }[] = [];
    const seenMonths = new Set<string>();
    for (const cell of cells) {
      const dateObj = new Date(cell.date);
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      if (!seenMonths.has(key) && cell.weekday === 0) {
        seenMonths.add(key);
        monthLabels.push({ weekIndex: cell.weekIndex, label: dateObj.toLocaleString("default", { month: "short" }) });
      }
    }
    const revenues = cells.map((c) => c.revenue).filter((v) => v > 0);
    return { cells, weeksCount, monthLabels, maxRevenue: revenues.length ? Math.max(...revenues) : 0 };
  }, [calendar]);

  const monthLayout = useMemo(() => {
    if (!calendarLayout) return null;
    const start = new Date(calendarYear, calendarMonth, 1);
    const end   = new Date(calendarYear, calendarMonth + 1, 1);
    const startMonday = new Date(start);
    startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7));
    const endSunday = new Date(end);
    endSunday.setDate(endSunday.getDate() + (6 - ((endSunday.getDay() + 6) % 7)));
    const byDate = new Map(calendarLayout.cells.map((c) => [c.date, c]));
    const dates: { date: string; cell?: (typeof calendarLayout.cells)[number] }[] = [];
    for (let d = new Date(startMonday); d < endSunday; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dates.push({ date: key, cell: byDate.get(key) });
    }
    return { dates, weeksCount: Math.ceil(dates.length / 7), maxRevenue: calendarLayout.maxRevenue };
  }, [calendarLayout, calendarYear, calendarMonth]);

  // ── KPI cards data ───────────────────────────────────────────────────────

  const kpis = data?.kpis;
  const kpiCards = [
    { label: "Total Revenue",   value: kpis ? formatPrice(kpis.revenue)                   : "Rs. 0", trend: toSafeNum(kpis?.trends.revenue       ?? 0), subtitle: "vs last period", sparkData: combinedByDay.map((d) => d.revenue)     },
    { label: "Total Orders",    value: kpis ? kpis.orders.toLocaleString("en-NP")          : "0",     trend: toSafeNum(kpis?.trends.orders         ?? 0), subtitle: "vs last period", sparkData: combinedByDay.map((d) => d.orders)      },
    { label: "Avg Order Value", value: kpis ? formatPrice(kpis.avgOrderValue)               : "Rs. 0", trend: toSafeNum(kpis?.trends.avgOrderValue  ?? 0), subtitle: "vs last period", sparkData: combinedByDay.map((d) => d.aov)         },
    { label: "New Customers",   value: kpis ? kpis.newCustomers.toLocaleString("en-NP")    : "0",     trend: toSafeNum(kpis?.trends.newCustomers    ?? 0), subtitle: "vs last period", sparkData: combinedByDay.map((d) => d.newCustomers) },
  ];

  // ── Heat colour ──────────────────────────────────────────────────────────

  const heatColor = (revenue: number, max: number, isHoliday: boolean) => {
    if (revenue <= 0 && isHoliday) return "hsl(var(--muted)/0.3)";
    if (revenue <= 0)              return "hsl(var(--muted)/0.1)";
    const r = max > 0 ? revenue / max : 0;
    if (r > 0.75) return COLOR_TOKENS.heatPeak;
    if (r > 0.5)  return COLOR_TOKENS.heatHigh;
    if (r > 0.25) return COLOR_TOKENS.heatMedium;
    return COLOR_TOKENS.heatLow;
  };

  // ────────────────────────────────────────────────────────────────────────

  const commonPieColors = [COLOR_TOKENS.emerald, COLOR_TOKENS.blue, COLOR_TOKENS.purple, COLOR_TOKENS.amber, COLOR_TOKENS.red];

  return (
    <div className="min-h-screen bg-muted dark:bg-neutral-900 pb-20 admin-font">

      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-border/50 mb-8 bg-card/30 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-foreground leading-none">
            Analytics
          </h1>
          <p className="text-[10px] text-muted-foreground mt-2 font-black uppercase tracking-[0.2em]">
            {RANGE_LABELS[range]} — performance overview
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1 shadow-sm">
            {(["7d", "30d", "90d", "1y"] as const).map((r) => (
              <Button 
                key={r} 
                variant={range === r ? "default" : "ghost"}
                size="sm"
                onClick={() => setRange(r)}
                className={cn(
                  "h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  range === r ? "shadow-md" : "hover:bg-muted"
                )}
              >
                {r}
              </Button>
            ))}
          </div>
          <ExportButton onExport={() => exportAnalyticsCSV(range)} />
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-8">

        {/* KPI Row */}
        {kpiCards.map((c, idx) => (
          <KpiCard key={c.label} {...c} idx={idx} isLoading={isLoading} />
        ))}

        {/* Revenue + Orders combo — 3 cols */}
        <div className={cn(cardStyles, "lg:col-span-3")}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className={sectionTitleStyles}>Revenue & Orders</div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest -mt-3">
                Daily trends and volume
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={combinedByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLOR_TOKENS.emerald} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={COLOR_TOKENS.emerald} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={COLOR_TOKENS.border} opacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} interval="preserveStartEnd" />
              <YAxis yAxisId="orders"  orientation="left"  tickLine={false} axisLine={false} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} allowDecimals={false} />
              <YAxis yAxisId="revenue" orientation="right" tickLine={false} axisLine={false} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} tickFormatter={(v) => `Rs.${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => p.name === "orders" ? `${p.value.toLocaleString("en-NP")} orders` : formatPrice(p.value)} />} />
              <Bar  dataKey="orders"  yAxisId="orders"  fill={COLOR_TOKENS.amber} fillOpacity={0.2} stroke={COLOR_TOKENS.amber} strokeWidth={1} radius={[4,4,0,0]} barSize={20} />
              <Area dataKey="revenue" yAxisId="revenue" type="monotone" stroke={COLOR_TOKENS.emerald} strokeWidth={3} fill="url(#rev-fill)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Order status donut — 1 col */}
        <div className={cardStyles}>
          <div className={sectionTitleStyles}>Order Status</div>
          <div className="flex justify-center items-center h-48 mb-4">
            {ordersStatusData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersStatusData}
                    dataKey="value"
                    isAnimationActive={false}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {ordersStatusData.map((e, i) => (
                      <Cell key={i} fill={e.hex} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.payload?.status}: ${p.value?.toLocaleString("en-NP")}`} />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-3">
            {ordersStatusData.map((row) => {
              const total = ordersStatusData.reduce((s,o)=>s+o.value,0);
              const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={row.key} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                    <span className="text-muted-foreground">{row.status}</span>
                  </span>
                  <span className="text-foreground">
                    {row.value.toLocaleString("en-NP")} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products — 2 cols */}
        <TopProductsSection analytics={data} isLoading={isLoading} className="lg:col-span-2" />

        {/* Orders by weekday */}
        <div className={cardStyles}>
          <div className={sectionTitleStyles}>Orders by Day</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ordersByDayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={COLOR_TOKENS.border} opacity={0.5} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} />
              <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.value.toLocaleString("en-NP")} orders`} />} />
              <Bar dataKey="count" radius={[4,4,0,0]} fill={COLOR_TOKENS.purple} fillOpacity={0.2} stroke={COLOR_TOKENS.purple} strokeWidth={1} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment methods */}
        <div className={cardStyles}>
          <div className={sectionTitleStyles}>Payment Methods</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={paymentMethodsData} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="method" axisLine={false} tickLine={false} width={80} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} />
              <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.value.toLocaleString("en-NP")} · ${p.payload?.percent?.toFixed(1)}%`} />} />
              <Bar dataKey="count" radius={[0,4,4,0]} barSize={16} fill={COLOR_TOKENS.blue} fillOpacity={0.2} stroke={COLOR_TOKENS.blue} strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Platform — 2 cols */}
        <div className={cn(cardStyles, "lg:col-span-2")}>
          <div className={sectionTitleStyles}>Revenue by Platform</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(data?.revenueByPlatform ?? []).slice(0, 8)} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={COLOR_TOKENS.border} opacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} tickFormatter={(v) => v >= 1000 ? `Rs.${Math.round(v / 1000)}k` : `Rs.${v}`} />
              <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${formatPrice(p.value)} · ${p.payload?.percent?.toFixed(1)}%`} />} />
              <Bar dataKey="revenue" radius={[6,6,0,0]} fill={COLOR_TOKENS.emerald} fillOpacity={0.2} stroke={COLOR_TOKENS.emerald} strokeWidth={1} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
          <Collapsible className="mt-6 pt-6 border-t border-border/50">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between h-9 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-muted/50 rounded-xl">
                Platform management <ChevronDown size={14} className="ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="flex gap-2">
                <Input placeholder="key (e.g. instagram)" value={newPlatformKey} onChange={(e) => setNewPlatformKey(e.target.value.toLowerCase())} className="h-9 text-xs font-bold uppercase tracking-wider rounded-xl" />
                <Input placeholder="label" value={newPlatformLabel} onChange={(e) => setNewPlatformLabel(e.target.value)} className="h-9 text-xs font-bold uppercase tracking-wider rounded-xl" />
                <Button type="button" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl"
                  disabled={!newPlatformKey || !newPlatformLabel || upsertPlatformMutation.isPending}
                  onClick={() => upsertPlatformMutation.mutate({ key: newPlatformKey, label: newPlatformLabel, isActive: true }, { onSuccess: () => { setNewPlatformKey(""); setNewPlatformLabel(""); } })}
                >Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {platforms.map((p) => (
                  <div key={p.key} className="inline-flex items-center gap-2 bg-muted/50 border border-border rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
                    {p.label}
                    <button type="button" className="text-muted-foreground hover:text-red-500 transition-colors" disabled={deletePlatformMutation.isPending} onClick={() => deletePlatformMutation.mutate(p.key)}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Revenue by Category */}
        <div className={cardStyles}>
          <div className={sectionTitleStyles}>Revenue by Category</div>
          <div className="flex justify-center items-center h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.salesByCategory ?? []).map(c=>({...c, revenue: toSafeNum(c.revenue)}))}
                  dataKey="revenue"
                  isAnimationActive={false}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {(data?.salesByCategory ?? []).map((_, i) => (
                    <Cell key={i} fill={commonPieColors[i % commonPieColors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.payload?.category}: ${formatPrice(p.value)}`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            {(data?.salesByCategory ?? []).slice(0, 4).map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: commonPieColors[i % commonPieColors.length] }} />
                  <span className="text-muted-foreground">{cat.category}</span>
                </span>
                <span className="text-foreground">{formatPrice(cat.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* New Customers */}
        <div className={cn(cardStyles, "border-t-4 border-t-violet-500")}>
          <div className="flex justify-between items-start mb-6">
            <div className={sectionTitleStyles}>New Customers</div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-500 px-2.5 py-1 rounded-full">
              {kpis?.newCustomers ?? 0} signups
            </span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={combinedByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cust-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLOR_TOKENS.purple} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={COLOR_TOKENS.purple} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={COLOR_TOKENS.border} opacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: COLOR_TOKENS.muted, fontSize: 10, fontWeight: "bold" }} allowDecimals={false} />
              <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.value} signups`} />} />
              <Area type="monotone" dataKey="newCustomers" stroke={COLOR_TOKENS.purple} strokeWidth={3} fill="url(#cust-fill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Heatmap — full width */}
        <div className={cn(cardStyles, "lg:col-span-4")}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <div className={sectionTitleStyles}>Sales Activity · {calendarYear}</div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest -mt-3">Daily revenue intensity calendar</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-muted/50 border border-border p-1 rounded-xl">
                {(["year","month"] as const).map((v) => (
                  <Button 
                    key={v} 
                    variant={calendarView === v ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setCalendarView(v)}
                    className={cn(
                      "h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg",
                      calendarView === v && "shadow-sm bg-background"
                    )}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <Input type="number" value={calendarYear} onChange={(e) => setCalendarYear(toSafeNum(e.target.value) || new Date().getFullYear())} className="h-9 w-24 text-xs font-black rounded-xl" min={2020} max={new Date().getFullYear() + 1} />
              {calendarView === "month" && (
                <Select value={String(calendarMonth)} onValueChange={(v) => setCalendarMonth(toSafeNum(v))}>
                  <SelectTrigger className="h-9 w-32 text-xs font-black rounded-xl"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent className="admin-font">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i} value={String(i)} className="text-[11px] font-bold uppercase tracking-widest">{new Date(calendarYear, i, 1).toLocaleString("default", { month: "long" })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {isCalendarLoading || !calendarLayout ? (
            <div className="h-40 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Loading dataset…</div>
          ) : (
            <div className="space-y-8">
              <div className="overflow-x-auto pb-4 scrollbar-hide">
                {calendarView === "year" ? (
                  <div className="inline-flex gap-4">
                    <div className="flex flex-col justify-between pt-8 pb-1 pr-4 text-[9px] font-black uppercase tracking-tighter text-muted-foreground h-[115px]">
                      <span>Mon</span>
                      <span>Wed</span>
                      <span>Fri</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
                        {Array.from({ length: calendarLayout.weeksCount }).map((_, wi) => {
                          const m = calendarLayout.monthLabels.find((ml) => ml.weekIndex === wi);
                          return <div key={wi} className="w-[14px] mr-1 flex justify-center">{m?.label ?? ""}</div>;
                        })}
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: calendarLayout.weeksCount }, (_, wi) => (
                          <div key={wi} className="flex flex-col gap-1">
                            {Array.from({ length: 7 }, (_, wd) => {
                              const cell = calendarLayout.cells.find((c) => c.weekIndex === wi && c.weekday === wd);
                              if (!cell) return <div key={wd} className="w-3.5 h-3.5 rounded-sm bg-transparent" />;
                              return (
                                <div key={wd} title={cell.revenue > 0 ? `${cell.date} · ${formatPrice(cell.revenue)}` : `${cell.date} · No sales`}
                                  className="w-3.5 h-3.5 rounded-sm border border-border/50 transition-all hover:scale-125 hover:z-10 cursor-pointer"
                                  style={{ background: heatColor(cell.revenue, calendarLayout.maxRevenue, cell.isHoliday) }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex gap-4 pt-4">
                    <div className="flex flex-col justify-between py-2 pr-4 text-[9px] font-black uppercase tracking-tighter text-muted-foreground h-[105px]">
                      <span>Mon</span>
                      <span>Wed</span>
                      <span>Fri</span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: monthLayout?.weeksCount ?? 0 }).map((_, wi) => (
                        <div key={wi} className="flex flex-col gap-1.5">
                          {Array.from({ length: 7 }, (_, wd) => {
                            const idx = wi * 7 + wd;
                            const entry = monthLayout?.dates[idx];
                            const cell = entry?.cell;
                            const inMonth = entry && new Date(entry.date).getFullYear() === calendarYear && new Date(entry.date).getMonth() === calendarMonth;
                            return (
                              <div key={wd} title={cell?.revenue && cell.revenue > 0 ? `${entry?.date} · ${formatPrice(cell.revenue)}` : `${entry?.date ?? ""} · No sales`}
                                className="w-4 h-4 rounded-[4px] border border-border/50 transition-all hover:scale-125 hover:z-10 cursor-pointer"
                                style={{ 
                                  background: heatColor(cell?.revenue ?? 0, monthLayout?.maxRevenue ?? 0, cell?.isHoliday ?? false),
                                  opacity: inMonth ? 1 : 0.1
                                }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/50 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <div className="flex items-center gap-6">
                  {[{ label: "No sales", bg: "hsl(var(--muted)/0.1)" },{ label: "Low", bg: COLOR_TOKENS.heatLow },{ label: "Medium", bg: COLOR_TOKENS.heatMedium },{ label: "High", bg: COLOR_TOKENS.heatHigh },{ label: "Peak", bg: COLOR_TOKENS.heatPeak }].map((s) => (
                    <span key={s.label} className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm border border-border/50" style={{ background: s.bg }} />
                      {s.label}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span>Less intensity</span>
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                  </div>
                  <span>More intensity</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Top Products Section ─────────────────────────────────────────────────────

function TopProductsSection({ analytics, isLoading, className }: { analytics: AdminAnalytics | undefined; isLoading: boolean; className?: string }) {
  const products = analytics?.topProducts ?? [];
  const top3 = useMemo(() => products.slice(0, 3).map(p=>({...p, revenue: toSafeNum(p.revenue)})), [products]);
  const pieColors = [COLOR_TOKENS.emerald, COLOR_TOKENS.blue, COLOR_TOKENS.purple, COLOR_TOKENS.amber, COLOR_TOKENS.red];

  const totalRevenue = useMemo(() => products.reduce((sum, pr) => sum + toSafeNum(pr.revenue), 0), [products]);

  return (
    <div className={cn(cardStyles, className)}>
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className={sectionTitleStyles}>Top Products</div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest -mt-3">Best performing items</p>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={48} />)}</div>
          ) : products.length === 0 ? (
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest py-10 text-center bg-muted/20 rounded-2xl border border-dashed border-border">No sales records found.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {products.slice(0, 10).map((p, idx) => {
                const calcPct = totalRevenue > 0 ? (toSafeNum(p.revenue) / totalRevenue * 100) : 0;
                return (
                  <div key={`${p.name}-${idx}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 border border-border flex-shrink-0 overflow-hidden shadow-sm">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-0.5 flex items-center gap-2">
                             <span className="text-emerald-500">#{idx + 1}</span>
                             <span>·</span>
                             <span>{p.units || 0} units</span>
                          </div>
                          <div className="text-sm font-black text-foreground truncate uppercase tracking-wider">{p.name}</div>
                        </div>
                        <div className="text-[13px] font-black text-emerald-500 tabular-nums ml-4">{formatPrice(p.revenue)}</div>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(calcPct, 100)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-emerald-500 rounded-full shadow-sm" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="xl:col-span-2 bg-muted/20 rounded-2xl border border-border/50 p-6 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-8">Revenue Distribution</div>
          <div className="w-full aspect-square max-w-[200px] mb-8">
            {top3.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={top3}
                    dataKey="revenue"
                    isAnimationActive={false}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={6}
                    stroke="none"
                  >
                    {top3.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} className="hover:opacity-80 transition-opacity" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<AgTooltip formatter={(p: any) => `${p.payload?.name}: ${formatPrice(p.value)}`} />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="w-full space-y-3">
            {top3.map((p, i) => {
              const displayPct = totalRevenue > 0 ? (toSafeNum(p.revenue) / totalRevenue * 100).toFixed(1) : "0.0";
              return (
                <div key={p.name} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: pieColors[i] }} />
                    <span className="text-muted-foreground truncate">{p.name}</span>
                  </span>
                  <span className="text-foreground shrink-0">{displayPct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
