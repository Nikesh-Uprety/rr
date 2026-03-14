import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  fetchAnalytics,
  fetchAnalyticsCalendar,
  exportAnalyticsCSV,
  type AdminAnalytics,
  type AdminAnalyticsCalendarDay,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/admin/ExportButton";

type RangeKey = "7d" | "30d" | "90d" | "1y";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
};

const STATUS_COLORS: Record<"completed" | "pending" | "cancelled", string> = {
  completed: "#2D4A35",
  pending: "#C9963A",
  cancelled: "#9A3A3A",
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
  const { data: calendar, isLoading: isCalendarLoading } =
    useAnalyticsCalendar(2025);

  const revenueChartData = useMemo(
    () =>
      data?.revenueByDay.map((d) => ({
        date: d.date,
        label: d.date.slice(5),
        revenue: d.revenue,
      })) ?? [],
    [data],
  );

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
      cells.length > 0
        ? Math.max(...cells.map((c) => c.weekIndex)) + 1
        : 0;

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

  const kpis = data?.kpis;

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
              ]
          ) as Array<{ label: string; subtitle: string; value: string; trend: number } | undefined>
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
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-emerald-800 dark:text-emerald-300">
                  <TrendIcon className="h-3 w-3" />
                  <span className="font-medium tabular-nums">
                    {trendInfo.label}
                  </span>
                </div>
                <span className="text-muted-foreground">{card.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Bar Chart */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-medium">
              Revenue Over Time
            </h2>
            <p className="text-xs text-muted-foreground">
              Daily revenue for the selected period
            </p>
          </div>
        </div>
        <ChartContainer
          config={{
            revenue: {
              label: "Revenue",
              color: "hsl(var(--accent))",
            },
          }}
          className="h-72 w-full"
        >
          <BarChart data={revenueChartData}>
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
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-medium">
                      {formatPrice(Number(value))}
                    </span>
                  )}
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
              dataKey="revenue"
              radius={[4, 4, 0, 0]}
              fill="var(--color-revenue)"
            />
          </BarChart>
        </ChartContainer>
      </section>

      {/* Orders status breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut: orders by status */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
          <h2 className="text-lg font-serif font-medium">
            Orders by Status
          </h2>
          <p className="text-xs text-muted-foreground">
            Distribution of orders in this period
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-56">
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
                        STATUS_COLORS[entry.key as "completed" | "pending" | "cancelled"]
                      }
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value, name) => [
                    value,
                    name as string,
                  ]}
                />
              </PieChart>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Total Orders
              </p>
              <p className="text-2xl font-serif font-semibold mt-1">
                {kpis?.orders.toLocaleString("en-NP") ?? "0"}
              </p>
            </div>
            <div className="w-full space-y-2">
              {ordersStatusChartData.map((row) => {
                const total = kpis?.orders ?? 0;
                const pct =
                  total > 0 ? (row.value / total) * 100 : 0;
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
                      {row.value.toLocaleString("en-NP")} ·{" "}
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Horizontal bars: orders by status */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
          <h2 className="text-lg font-serif font-medium">
            Status Breakdown
          </h2>
          <p className="text-xs text-muted-foreground">
            Actual counts by order status
          </p>
          <div className="h-56">
            <BarChart
              data={ordersStatusChartData}
              layout="vertical"
              margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
            >
              <XAxis
                type="number"
                hide
              />
              <YAxis
                type="category"
                dataKey="status"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <RechartsTooltip
                formatter={(value) => [
                  (value as number).toLocaleString("en-NP"),
                  "Orders",
                ]}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                barSize={18}
              >
                {ordersStatusChartData.map((row) => (
                  <Cell
                    key={row.key}
                    fill={
                      STATUS_COLORS[
                        row.key as "completed" | "pending" | "cancelled"
                      ]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </div>
        </div>
      </section>

      {/* Sales calendar heatmap */}
      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-medium">
              Sales Activity — 2025
            </h2>
            <p className="text-xs text-muted-foreground">
              GitHub-style calendar of daily revenue
            </p>
          </div>
        </div>

        {isCalendarLoading || !calendarLayout ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            Loading calendar…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                        <div
                          key={weekIndex}
                          className="flex flex-col gap-1"
                        >
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

                            let bg = "#F8F1EA"; // no sales
                            if (revenue > 0) {
                              const ratio =
                                calendarLayout.maxRevenue > 0
                                  ? revenue / calendarLayout.maxRevenue
                                  : 0;
                              if (ratio > 0.75) bg = "#2D4A35";
                              else if (ratio > 0.5) bg = "#4F7A5C";
                              else if (ratio > 0.25) bg = "#7FB392";
                              else bg = "#ECFDF5";
                            } else if (isHoliday) {
                              bg = "#E8E0D8";
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
                                className="w-3 h-3 rounded-[3px] border border-black/5"
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
            </div>
            <div className="flex items-center justify-between pt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] border border-black/5 bg-[#F8F1EA]" />
                  <span>No sales</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] border border-black/5 bg-[#ECFDF5]" />
                  <span>Low</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] border border-black/5 bg-[#7FB392]" />
                  <span>Medium</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] border border-black/5 bg-[#2D4A35]" />
                  <span>High</span>
                </span>
              </div>
              <span>Less ← → More</span>
            </div>
          </>
        )}
      </section>

      {/* Top products + additional charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <TopProductsTable analytics={data} isLoading={isLoading} />

        {/* Additional charts row */}
        <div className="space-y-4">
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
                    const greens = [
                      "#ECFDF5",
                      "#A7F3D0",
                      "#4ADE80",
                      "#166534",
                    ];
                    return (
                      <Cell
                        key={entry.category + index}
                        fill={greens[index % greens.length]}
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
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
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
            <div className="h-48">
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
                <RechartsTooltip
                  formatter={(value, _name, item) => {
                    const percent =
                      (item?.payload as any)?.percent ?? 0;
                    return [
                      `${(value as number).toLocaleString("en-NP")} · ${percent.toFixed(
                        1,
                      )}%`,
                      "Payments",
                    ];
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  fill="#2D4A35"
                />
              </BarChart>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TopProductsTable({
  analytics,
  isLoading,
}: {
  analytics: AdminAnalytics | undefined;
  isLoading: boolean;
}) {
  const [sortKey, setSortKey] = useState<
    "revenue" | "units" | "percent" | "name"
  >("revenue");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const products = analytics?.topProducts ?? [];

  const sorted = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => {
      const aVal =
        sortKey === "name"
          ? a.name.localeCompare(b.name)
          : sortKey === "units"
            ? a.units
            : sortKey === "percent"
              ? a.percent
              : a.revenue;
      const bVal =
        sortKey === "name"
          ? b.name.localeCompare(a.name)
          : sortKey === "units"
            ? b.units
            : sortKey === "percent"
              ? b.percent
              : b.revenue;
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    return copy.slice(0, 10);
  }, [products, sortKey, direction]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-medium">
            Top Products
          </h2>
          <p className="text-xs text-muted-foreground">
            Ranked by revenue, top 10
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-muted/40 overflow-hidden">
        <div className="grid grid-cols-[40px,2fr,80px,120px,80px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground bg-muted/60">
          <div>#</div>
          <button
            type="button"
            onClick={() => handleSort("name")}
            className="text-left"
          >
            Product
          </button>
          <button
            type="button"
            onClick={() => handleSort("units")}
            className="text-right"
          >
            Units
          </button>
          <button
            type="button"
            onClick={() => handleSort("revenue")}
            className="text-right"
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => handleSort("percent")}
            className="text-right"
          >
            Share
          </button>
        </div>

        <div className="divide-y divide-muted/60">
          {isLoading && (
            <div className="p-4 text-xs text-muted-foreground">
              Loading top products…
            </div>
          )}
          {!isLoading &&
            sorted.map((p, index) => (
              <div
                key={`${p.name}-${index}`}
                className="grid grid-cols-[40px,2fr,80px,120px,80px] gap-3 px-4 py-3 text-xs items-center"
              >
                <div className="text-muted-foreground tabular-nums">
                  {index + 1}
                </div>
                <div className="truncate">
                  <div className="font-medium">{p.name}</div>
                </div>
                <div className="text-right tabular-nums">
                  {p.units.toLocaleString("en-NP")}
                </div>
                <div className="text-right tabular-nums">
                  {formatPrice(p.revenue)}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular-nums text-[11px]">
                    {p.percent.toFixed(1)}%
                  </span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2D4A35]"
                      style={{ width: `${Math.min(p.percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          {!isLoading && sorted.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              No products in this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}