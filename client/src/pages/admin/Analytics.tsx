import { ExportButton } from "@/components/admin/ExportButton";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

type RangeKey = "7d" | "30d" | "90d" | "1y";
type CalendarView = "year" | "month";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
};

const STATUS_COLORS: Record<"completed" | "pending" | "cancelled", string> = {
  completed: "hsl(142, 60%, 45%)", // Bright green
  pending: "hsl(45, 93%, 47%)", // Amber
  cancelled: "hsl(0, 84%, 60%)", // Red
};

const PAYMENT_LABELS: Record<string, string> = {
  esewa: "eSewa",
  cash_on_delivery: "Cash on Delivery",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

function formatTrend(value: number): { label: string; isPositive: boolean } {
  if (!Number.isFinite(value) || value === 0) {
    return { label: "0%", isPositive: true };
  }
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return {
    label: `${sign}${rounded}%`,
    isPositive: rounded >= 0,
  };
}

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

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data, isLoading } = useAnalytics(range);
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [calendarView, setCalendarView] = useState<CalendarView>("year");
  const [calendarMonth, setCalendarMonth] = useState<number>(
    new Date().getMonth(),
  );
  const { data: calendar, isLoading: isCalendarLoading } =
    useAnalyticsCalendar(calendarYear);

  const revenueChartData = useMemo(
    () =>
      data?.revenueByDay.map((d) => ({
        date: d.date,
        label: d.date.slice(5),
        revenue: d.revenue,
      })) ?? [],
    [data],
  );

  const combinedByDay = useMemo(() => {
    const revenueByDate = new Map(
      (data?.revenueByDay ?? []).map((d) => [d.date, d.revenue] as const),
    );
    const ordersByDate = new Map(
      (data?.ordersByDay ?? []).map((d) => [d.date, d.count] as const),
    );
    const customersByDate = new Map(
      (data?.newCustomersByDay ?? []).map((d) => [d.date, d.count] as const),
    );

    const allDates = Array.from(
      new Set([
        ...(data?.revenueByDay ?? []).map((d) => d.date),
        ...(data?.ordersByDay ?? []).map((d) => d.date),
        ...(data?.newCustomersByDay ?? []).map((d) => d.date),
      ]),
    ).sort();

    return allDates.map((date) => {
      const revenue = revenueByDate.get(date) ?? 0;
      const orders = ordersByDate.get(date) ?? 0;
      const newCustomers = customersByDate.get(date) ?? 0;
      const aov = orders > 0 ? revenue / orders : 0;
      return {
        date,
        label: date.slice(5),
        revenue,
        orders,
        newCustomers,
        aov,
      };
    });
  }, [data]);

  const ordersStatusChartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        status: "Completed",
        key: "completed",
        value: data.ordersByStatus.completed,
      },
      {
        status: "Pending",
        key: "pending",
        value: data.ordersByStatus.pending,
      },
      {
        status: "Cancelled",
        key: "cancelled",
        value: data.ordersByStatus.cancelled,
      },
    ];
  }, [data]);

  const paymentMethodsData = useMemo(() => {
    if (!data) return [];
    return data.paymentMethods.map((m) => ({
      method: PAYMENT_LABELS[m.method] ?? m.method,
      key: m.method,
      count: m.count,
      percent: m.percent,
    }));
  }, [data]);

  const ordersByDayOfWeekData = useMemo(
    () =>
      data?.ordersByDayOfWeek.map((d) => ({
        day: d.day,
        count: d.count,
      })) ?? [],
    [data],
  );

  const calendarLayout = useMemo(() => {
    if (!calendar || calendar.length === 0) return null;

    const startDate = new Date(calendar[0].date);
    const endDate = new Date(calendar[calendar.length - 1].date);

    // Monday-first layout
    const getWeekIndex = (date: Date) => {
      const start = new Date(startDate);
      const diffDays = Math.floor(
        (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      return Math.floor(diffDays / 7);
    };

    const cells = calendar.map((day) => {
      const dateObj = new Date(day.date);
      const weekday = (dateObj.getDay() + 6) % 7; // 0 = Mon
      return {
        ...day,
        weekIndex: getWeekIndex(dateObj),
        weekday,
      };
    });

    const weeksCount =
      cells.length > 0 ? Math.max(...cells.map((c) => c.weekIndex)) + 1 : 0;

    // Month labels
    const monthLabels: { weekIndex: number; label: string }[] = [];
    const seenMonths = new Set<string>();
    for (const cell of cells) {
      const dateObj = new Date(cell.date);
      const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      if (!seenMonths.has(monthKey) && cell.weekday === 0) {
        seenMonths.add(monthKey);
        monthLabels.push({
          weekIndex: cell.weekIndex,
          label: dateObj.toLocaleString("default", { month: "short" }),
        });
      }
    }

    // Revenue scale
    const revenues = cells.map((c) => c.revenue).filter((v) => v > 0);
    const maxRevenue = revenues.length ? Math.max(...revenues) : 0;

    return { cells, weeksCount, monthLabels, maxRevenue };
  }, [calendar]);

  const monthLayout = useMemo(() => {
    if (!calendarLayout) return null;

    const start = new Date(calendarYear, calendarMonth, 1);
    const end = new Date(calendarYear, calendarMonth + 1, 1);

    // Align grid to Monday-start week like the year view.
    const startMonday = new Date(start);
    const startWeekday = (startMonday.getDay() + 6) % 7; // 0=Mon
    startMonday.setDate(startMonday.getDate() - startWeekday);

    const endSunday = new Date(end);
    const endWeekday = (endSunday.getDay() + 6) % 7;
    endSunday.setDate(endSunday.getDate() + (6 - endWeekday));

    const byDate = new Map(calendarLayout.cells.map((c) => [c.date, c]));
    const dates: {
      date: string;
      cell?: (typeof calendarLayout.cells)[number];
    }[] = [];
    for (
      let d = new Date(startMonday);
      d < endSunday;
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().slice(0, 10);
      dates.push({ date: key, cell: byDate.get(key) });
    }

    return {
      dates,
      weeksCount: Math.ceil(dates.length / 7),
      maxRevenue: calendarLayout.maxRevenue,
    };
  }, [calendarLayout, calendarYear, calendarMonth]);

  const kpis = data?.kpis;

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            {RANGE_LABELS[range]} — historical performance
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          {(["7d", "30d", "90d", "1y"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                range === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <ExportButton onExport={() => exportAnalyticsCSV(range)} />
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(
          (isLoading || !kpis
            ? Array.from({ length: 4 })
            : [
                {
                  label: "Total Revenue",
                  subtitle: "vs last period",
                  value:
                    kpis && formatPrice(kpis.revenue)
                      ? formatPrice(kpis.revenue)
                      : "Rs. 0",
                  trend: kpis ? kpis.trends.revenue : 0,
                },
                {
                  label: "Total Orders",
                  subtitle: "vs last period",
                  value: kpis ? kpis.orders.toLocaleString("en-NP") : "0",
                  trend: kpis ? kpis.trends.orders : 0,
                },
                {
                  label: "Avg Order Value",
                  subtitle: "vs last period",
                  value: kpis ? formatPrice(kpis.avgOrderValue) : "Rs. 0",
                  trend: kpis ? kpis.trends.avgOrderValue : 0,
                },
                {
                  label: "New Customers",
                  subtitle: "vs last period",
                  value: kpis ? kpis.newCustomers.toLocaleString("en-NP") : "0",
                  trend: kpis ? kpis.trends.newCustomers : 0,
                },
              ]) as Array<
            | { label: string; subtitle: string; value: string; trend: number }
            | undefined
          >
        ).map((card, idx) => {
          if (isLoading || !kpis || !card) {
            return (
              <div
                key={idx}
                className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4"
              >
                <div className="h-3 w-24 bg-muted animate-pulse rounded-full" />
                <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded-full" />
              </div>
            );
          }

          const trendInfo = formatTrend(card.trend);
          const TrendIcon = trendInfo.isPositive
            ? ArrowUpRight
            : ArrowDownRight;

          const sparkKey =
            card.label === "Total Revenue"
              ? "revenue"
              : card.label === "Total Orders"
                ? "orders"
                : card.label === "Avg Order Value"
                  ? "aov"
                  : "newCustomers";

          const sparkColor = trendInfo.isPositive
            ? "hsl(142, 60%, 45%)"
            : "hsl(0, 84%, 60%)";

          return (
            <div
              key={card.label}
              className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 flex flex-col gap-3"
            >
              <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                {card.label}
              </div>
              <div className="text-3xl sm:text-4xl font-serif font-semibold text-[#1C2A20] dark:text-foreground">
                {card.value}
              </div>
              <div className="flex items-center justify-between text-xs">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                    trendInfo.isPositive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  <span className="font-medium tabular-nums">
                    {trendInfo.label}
                  </span>
                </div>
                <span className="text-muted-foreground">{card.subtitle}</span>
              </div>

              {/* Mini sparkline */}
              <div className="-mx-1 mt-1">
                <AreaChart width={180} height={36} data={combinedByDay.slice(-Math.min(combinedByDay.length, 30))}>
                  <defs>
                    <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sparkColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey={sparkKey}
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    fill={`url(#spark-${idx})`}
                    dot={false}
                  />
                </AreaChart>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue + Orders combo */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-medium">
              Revenue & Orders
            </h2>
            <p className="text-xs text-muted-foreground">
              Daily revenue (line) with order volume (bars)
            </p>
          </div>
        </div>
        <ChartContainer
          config={{
            revenue: {
              label: "Revenue",
              color: "hsl(142, 60%, 45%)",
            },
            orders: {
              label: "Orders",
              color: "hsl(45, 93%, 47%)",
            },
          }}
          className="h-56 w-full mt-4 aspect-auto"
        >
          <ComposedChart
            data={combinedByDay}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(142, 60%, 45%)"
                  stopOpacity={0.22}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(142, 60%, 45%)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-muted"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "currentColor", opacity: 0.6, fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="orders"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "currentColor", opacity: 0.6, fontSize: 11 }}
              orientation="left"
              allowDecimals={false}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "currentColor", opacity: 0.6, fontSize: 11 }}
              tickFormatter={(value) =>
                `Rs.${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
              }
            />
            <ChartTooltip
              cursor={{
                stroke: "currentColor",
                strokeWidth: 1,
                strokeOpacity: 0.2,
              }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "orders") {
                      return (
                        <span className="font-medium">
                          {Number(value).toLocaleString("en-NP")} orders
                        </span>
                      );
                    }
                    return (
                      <span className="font-medium">
                        {formatPrice(Number(value))}
                      </span>
                    );
                  }}
                  labelFormatter={(_, payload) => {
                    const date = payload?.[0]?.payload?.date as
                      | string
                      | undefined;
                    if (!date) return null;
                    const d = new Date(date);
                    return d.toLocaleDateString("en-NP", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey="orders"
              yAxisId="orders"
              fill="var(--color-orders)"
              radius={[4, 4, 0, 0]}
              barSize={14}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              yAxisId="revenue"
              stroke="hsl(142, 60%, 45%)"
              strokeWidth={2.25}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              yAxisId="revenue"
              stroke="none"
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </ComposedChart>
        </ChartContainer>
      </section>

      {/* Orders status breakdown (single chart) */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <h2 className="text-lg font-serif font-medium">Orders by Status</h2>
        <p className="text-xs text-muted-foreground">
          Distribution of orders in this period
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <ChartContainer
            config={{
              completed: { label: "Completed", color: STATUS_COLORS.completed },
              pending: { label: "Pending", color: STATUS_COLORS.pending },
              cancelled: { label: "Cancelled", color: STATUS_COLORS.cancelled },
            }}
            className="h-56 w-full aspect-auto"
          >
            <PieChart>
              <Pie
                data={ordersStatusChartData}
                dataKey="value"
                nameKey="status"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                stroke="none"
              >
                {ordersStatusChartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      STATUS_COLORS[
                        entry.key as "completed" | "pending" | "cancelled"
                      ]
                    }
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const status = (item?.payload as any)?.key as
                        | "completed"
                        | "pending"
                        | "cancelled"
                        | undefined;
                      const label =
                        status === "completed"
                          ? "Completed"
                          : status === "pending"
                            ? "Pending"
                            : status === "cancelled"
                              ? "Cancelled"
                              : undefined;
                      return (
                        <span className="font-medium">
                          {(value as number).toLocaleString("en-NP")}
                          {label ? ` · ${label}` : ""}
                        </span>
                      );
                    }}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
          <div className="space-y-3">
            <div className="text-center lg:text-left">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Total Orders
              </p>
              <p className="text-2xl font-serif font-semibold mt-1">
                {kpis?.orders.toLocaleString("en-NP") ?? "0"}
              </p>
            </div>
            <div className="space-y-2">
              {ordersStatusChartData.map((row) => {
                const total = kpis?.orders ?? 0;
                const pct = total > 0 ? (row.value / total) * 100 : 0;
                return (
                  <div
                    key={row.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[
                              row.key as "completed" | "pending" | "cancelled"
                            ],
                        }}
                      />
                      <span className="text-muted-foreground">
                        {row.status}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {row.value.toLocaleString("en-NP")} · {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Sales calendar heatmap */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-serif font-medium">
              Sales Activity — {calendarYear}
            </h2>
            <p className="text-xs text-muted-foreground">
              GitHub-style calendar of daily revenue
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
              {(["year", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalendarView(v)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                    calendarView === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "year" ? "Year" : "Month"}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={calendarYear}
              onChange={(e) =>
                setCalendarYear(
                  Number(e.target.value) || new Date().getFullYear(),
                )
              }
              className="w-24 h-9"
              min={2020}
              max={new Date().getFullYear() + 1}
            />
            {calendarView === "month" && (
              <Select
                value={String(calendarMonth)}
                onValueChange={(v) => setCalendarMonth(Number(v))}
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {new Date(calendarYear, i, 1).toLocaleString("default", {
                        month: "short",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {isCalendarLoading || !calendarLayout ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            Loading calendar…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              {calendarView === "year" ? (
                <div className="inline-flex gap-4">
                  <div className="flex flex-col items-end justify-between py-6 pr-2 text-[10px] text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                      <span key={d} className="h-3 leading-3">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {/* Month labels */}
                    <div className="flex text-[10px] text-muted-foreground mb-1">
                      {Array.from({ length: calendarLayout.weeksCount }).map(
                        (_, weekIndex) => {
                          const month = calendarLayout.monthLabels.find(
                            (m) => m.weekIndex === weekIndex,
                          );
                          return (
                            <div
                              key={weekIndex}
                              className="w-3 h-3 flex items-center justify-center"
                            >
                              {month?.label ?? ""}
                            </div>
                          );
                        },
                      )}
                    </div>
                    {/* Day cells */}
                    <div className="flex gap-1">
                      {Array.from(
                        { length: calendarLayout.weeksCount },
                        (_, weekIndex) => (
                          <div key={weekIndex} className="flex flex-col gap-1">
                            {Array.from({ length: 7 }, (_, weekday) => {
                              const cell = calendarLayout.cells.find(
                                (c) =>
                                  c.weekIndex === weekIndex &&
                                  c.weekday === weekday,
                              );
                              if (!cell) {
                                return (
                                  <div
                                    key={weekday}
                                    className="w-3 h-3 rounded-[3px] bg-transparent"
                                  />
                                );
                              }

                              const { revenue, isHoliday } = cell;

                              let bg = "var(--calendar-0)"; // no sales
                              if (revenue > 0) {
                                const ratio =
                                  calendarLayout.maxRevenue > 0
                                    ? revenue / calendarLayout.maxRevenue
                                    : 0;
                                if (ratio > 0.75) bg = "var(--calendar-4)";
                                else if (ratio > 0.5) bg = "var(--calendar-3)";
                                else if (ratio > 0.25) bg = "var(--calendar-2)";
                                else bg = "var(--calendar-1)";
                              } else if (isHoliday) {
                                bg = "var(--calendar-holiday)";
                              }

                              const title =
                                revenue > 0
                                  ? `${cell.date} · ${formatPrice(
                                      revenue,
                                    )} revenue`
                                  : `${cell.date} · No sales`;

                              return (
                                <div
                                  key={weekday}
                                  title={title}
                                  className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                                  style={{ backgroundColor: bg }}
                                />
                              );
                            })}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="inline-flex gap-4">
                  <div className="flex flex-col items-end justify-between py-6 pr-2 text-[10px] text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                      <span key={d} className="h-3 leading-3">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: monthLayout?.weeksCount ?? 0 }).map(
                      (_, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-1">
                          {Array.from({ length: 7 }, (_, weekday) => {
                            const idx = weekIndex * 7 + weekday;
                            const entry = monthLayout?.dates[idx];
                            const cell = entry?.cell;
                            const dateObj = entry ? new Date(entry.date) : null;
                            const inMonth =
                              dateObj &&
                              dateObj.getFullYear() === calendarYear &&
                              dateObj.getMonth() === calendarMonth;

                            const revenue = cell?.revenue ?? 0;
                            const isHoliday = cell?.isHoliday ?? false;

                            let bg = "var(--calendar-0)";
                            if (revenue > 0) {
                              const ratio =
                                (monthLayout?.maxRevenue ?? 0) > 0
                                  ? revenue / (monthLayout?.maxRevenue ?? 1)
                                  : 0;
                              if (ratio > 0.75) bg = "var(--calendar-4)";
                              else if (ratio > 0.5) bg = "var(--calendar-3)";
                              else if (ratio > 0.25) bg = "var(--calendar-2)";
                              else bg = "var(--calendar-1)";
                            } else if (isHoliday) {
                              bg = "var(--calendar-holiday)";
                            }

                            const title =
                              revenue > 0
                                ? `${entry?.date} · ${formatPrice(revenue)} revenue`
                                : `${entry?.date} · No sales`;

                            return (
                              <div
                                key={weekday}
                                title={title}
                                className={cn(
                                  "w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5",
                                  inMonth ? "" : "opacity-35",
                                )}
                                style={{ backgroundColor: bg }}
                              />
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                    style={{ backgroundColor: "var(--calendar-0)" }}
                  />
                  <span>No sales</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                    style={{ backgroundColor: "var(--calendar-1)" }}
                  />
                  <span>Low</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                    style={{ backgroundColor: "var(--calendar-2)" }}
                  />
                  <span>Medium</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                    style={{ backgroundColor: "var(--calendar-3)" }}
                  />
                  <span>High</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-black/5 dark:border-white/5"
                    style={{ backgroundColor: "var(--calendar-4)" }}
                  />
                  <span>Very High</span>
                </span>
              </div>
              <span>Less ← → More</span>
            </div>
          </>
        )}
      </section>

      {/* Top products + additional charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products */}
        <TopProductsSection analytics={data} isLoading={isLoading} />

        {/* Additional charts row */}
        <div className="space-y-4">
          {/* Revenue by Platform */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Revenue by Platform
            </h3>
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "#2D4A35" },
              }}
              className="h-48 w-full"
            >
              <BarChart
                data={(data?.revenueByPlatform ?? []).slice(0, 8)}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                  tickFormatter={(value) =>
                    value >= 1000
                      ? `Rs.${Math.round(value / 1000)}k`
                      : `Rs.${value}`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const pct = (item?.payload as any)?.percent ?? 0;
                        return (
                          <span className="font-medium">
                            {formatPrice(Number(value))} ·{" "}
                            {Number(pct).toFixed(1)}%
                          </span>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#2D4A35" />
              </BarChart>
            </ChartContainer>

            <Collapsible>
              <div className="pt-2 border-t border-muted/30">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-semibold py-2"
                  >
                    <span>Platform management</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 pb-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="key (e.g. instagram)"
                        value={newPlatformKey}
                        onChange={(e) =>
                          setNewPlatformKey(e.target.value.toLowerCase())
                        }
                        className="h-9"
                      />
                      <Input
                        placeholder="label (e.g. Instagram)"
                        value={newPlatformLabel}
                        onChange={(e) => setNewPlatformLabel(e.target.value)}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        className="h-9"
                        disabled={
                          !newPlatformKey ||
                          !newPlatformLabel ||
                          upsertPlatformMutation.isPending
                        }
                        onClick={() => {
                          upsertPlatformMutation.mutate(
                            {
                              key: newPlatformKey,
                              label: newPlatformLabel,
                              isActive: true,
                            },
                            {
                              onSuccess: () => {
                                setNewPlatformKey("");
                                setNewPlatformLabel("");
                              },
                            },
                          );
                        }}
                      >
                        Add
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {platforms.map((p) => (
                        <div
                          key={p.key}
                          className="inline-flex items-center gap-2 rounded-full border border-muted/40 bg-muted/20 px-3 py-1.5 text-xs"
                        >
                          <span className="font-medium">{p.label}</span>
                          <span className="text-muted-foreground">({p.key})</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            disabled={deletePlatformMutation.isPending}
                            onClick={() => deletePlatformMutation.mutate(p.key)}
                            aria-label={`Delete platform ${p.key}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {platforms.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No custom platforms yet. Defaults (Website/POS/Instagram/TikTok) still work.
                        </p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Revenue by Category */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Revenue by Category
            </h3>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "#2D4A35",
                },
              }}
              className="h-56 w-full"
            >
              <PieChart>
                <Pie
                  data={data?.salesByCategory ?? []}
                  dataKey="revenue"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {(data?.salesByCategory ?? []).map((entry, index) => {
                    const catColors = [
                      "hsl(142, 60%, 45%)", // Primary Green
                      "hsl(150, 60%, 55%)",
                      "hsl(160, 60%, 65%)",
                      "hsl(170, 60%, 75%)",
                      "hsl(180, 60%, 85%)",
                    ];
                    return (
                      <Cell
                        key={entry.category + index}
                        fill={catColors[index % catColors.length]}
                      />
                    );
                  })}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="font-medium">
                          {formatPrice(Number(value))} ({name as string})
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend
                  verticalAlign="bottom"
                  content={<ChartLegendContent />}
                />
              </PieChart>
            </ChartContainer>
          </div>

          {/* Orders by Day of Week */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Orders by Day of Week
            </h3>
            <ChartContainer
              config={{
                orders: {
                  label: "Orders",
                  color: "#2D4A35",
                },
              }}
              className="h-48 w-full"
            >
              <BarChart data={ordersByDayOfWeekData}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium">
                          {Number(value).toLocaleString("en-NP")} orders
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  radius={[3, 3, 0, 0]}
                  fill="var(--color-orders)"
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Payment Methods */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Payment Methods
            </h3>
            <ChartContainer
              config={{
                payments: { label: "Payments", color: "#2D4A35" },
              }}
              className="h-48"
            >
              <BarChart
                data={paymentMethodsData}
                layout="vertical"
                margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="method"
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const percent = (item?.payload as any)?.percent ?? 0;
                        return (
                          <span className="font-medium">
                            {(value as number).toLocaleString("en-NP")} · {Number(percent).toFixed(1)}%
                          </span>
                        );
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  fill="var(--color-payments)"
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </section>

      {/* New Customers over time */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-serif font-medium">New Customers</h2>
          <p className="text-xs text-muted-foreground">
            New customer signups over the selected range
          </p>
        </div>
        <ChartContainer
          config={{
            customers: { label: "Customers", color: "hsl(142, 60%, 45%)" },
          }}
          className="h-56 w-full"
        >
          <LineChart data={combinedByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "currentColor", opacity: 0.6, fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-medium">
                      {Number(value).toLocaleString("en-NP")} customers
                    </span>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="newCustomers"
              stroke="var(--color-customers)"
              strokeWidth={2.25}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </section>
    </div>
  );
}

function TopProductsSection({
  analytics,
  isLoading,
}: {
  analytics: AdminAnalytics | undefined;
  isLoading: boolean;
}) {
  const products = analytics?.topProducts ?? [];

  const top3 = useMemo(() => products.slice(0, 3), [products]);
  const top3Total = useMemo(
    () => top3.reduce((acc, p) => acc + p.revenue, 0),
    [top3],
  );

  const pieColors = [
    "hsl(142, 60%, 45%)",
    "hsl(150, 60%, 55%)",
    "hsl(160, 60%, 65%)",
  ];

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-serif font-medium">Top Products</h2>
        <p className="text-xs text-muted-foreground">
          Ranked by revenue, top 10
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-4 text-xs text-muted-foreground">
              Loading top products…
            </div>
          ) : products.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No products in this period.
            </div>
          ) : (
            <div className="space-y-2">
              {products.slice(0, 10).map((p, idx) => (
                <div
                  key={`${p.name}-${idx}`}
                  className="flex items-center gap-3 rounded-xl border border-muted/40 bg-muted/20 px-3 py-2.5"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                          #{idx + 1}
                        </div>
                        <div className="font-medium truncate">{p.name}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Revenue
                        </div>
                        <div className="font-semibold">
                          {formatPrice(p.revenue)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2D4A35]"
                          style={{ width: `${Math.min(p.percent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {p.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: pie (top 3) */}
        <div className="rounded-xl border border-muted/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Top 3 share
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatPrice(top3Total)}
            </div>
          </div>
          <ChartContainer
            config={{
              revenue: { label: "Revenue", color: "hsl(142, 60%, 45%)" },
            }}
            className="h-56 w-full"
          >
            <PieChart>
              <Pie
                data={top3}
                dataKey="revenue"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                stroke="none"
              >
                {top3.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={pieColors[index % pieColors.length]}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const name = (item?.payload as any)?.name as
                        | string
                        | undefined;
                      return (
                        <span className="font-medium">
                          {name ? `${name}: ` : ""}
                          {formatPrice(Number(value))}
                        </span>
                      );
                    }}
                  />
                }
              />
              <ChartLegend
                verticalAlign="bottom"
                content={<ChartLegendContent />}
              />
            </PieChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}
