import { useMemo, useState } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
} from "recharts";
import { BarChart as MuiBarChart } from "@mui/x-charts/BarChart";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { AdminCustomer } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme";

type ViewMode = "orders" | "revenue";
type TimeRange = "1w" | "1m" | "all";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1w": "1 Week",
  "1m": "1 Month",
  all: "All Time",
};

const BAR_GRADIENTS = [
  { from: "#1D4ED8", to: "#38BDF8" }, // blue -> sky
  { from: "#0EA5E9", to: "#22C55E" }, // sky -> green
  { from: "#14B8A6", to: "#60A5FA" }, // teal -> blue
  { from: "#8B5CF6", to: "#EC4899" }, // violet -> pink
  { from: "#F97316", to: "#F59E0B" }, // orange -> amber
  { from: "#E11D48", to: "#FB7185" }, // rose -> pink
  { from: "#22C55E", to: "#A3E635" }, // green -> lime
  { from: "#06B6D4", to: "#3B82F6" }, // cyan -> blue
  { from: "#3B82F6", to: "#A78BFA" }, // blue -> violet
  { from: "#10B981", to: "#34D399" }, // emerald
  { from: "#F59E0B", to: "#FDE047" }, // amber -> yellow
  { from: "#6366F1", to: "#38BDF8" }, // indigo -> sky
  { from: "#0EA5E9", to: "#A78BFA" }, // sky -> violet
  { from: "#22C55E", to: "#38BDF8" }, // green -> sky
  { from: "#F97316", to: "#EC4899" }, // orange -> pink
];

function CustomerAvatarTick({ x, y, payload, customers }: any) {
  const customer = customers.find((c: any) => c.id === payload?.value);
  if (!customer) return null;

  const displayName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email || "Unknown";
  const displayLabel = customer.phoneNumber
    ? `${displayName} (${customer.phoneNumber})`
    : displayName;

  const avatarUrl = customer.profileImageUrl;
  const initials = `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-240} y={-12} width={230} height={24}>
        {/* @ts-expect-error foreignObject needs xmlns for SVG */}
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center gap-2 h-full">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-border"
              style={{ width: 20, height: 20 }}
            />
          ) : (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[8px] font-bold"
              style={{ width: 20, height: 20, backgroundColor: customer.avatarColor || "#2C5234" }}
            >
              {initials}
            </div>
          )}
          <span
            className="text-xs truncate"
            style={{ fontSize: 11, fill: "hsl(var(--foreground))", color: "hsl(var(--foreground))" }}
          >
            {displayLabel}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

const CustomTooltip = ({ active, payload, viewMode }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <div className="font-semibold mb-1">{data.name}</div>
      <div className="space-y-0.5">
        {viewMode === "revenue" ? (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-medium">{formatPrice(data.revenue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Orders:</span>
              <span className="font-medium">{data.orders}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Orders:</span>
              <span className="font-medium">{data.orders}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-medium">{formatPrice(data.revenue)}</span>
            </div>
          </>
        )}
        {data.email && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium truncate max-w-[160px]">{data.email}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function OrdersRangeBarChart({ data, height }: { data: any[]; height: number }) {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const tierColors = {
    top: isDark ? "#f5c04f" : "#7C3AED",
    mid: isDark ? "#38bdf8" : "#0EA5E9",
    rest: isDark ? "#34d399" : "#10B981",
  };

  const dataset = data.map((item, index) => {
    const rank = data.length - index;
    const tier = rank <= 5 ? "top" : rank <= 10 ? "mid" : "rest";

    return {
      id: item.id,
      name: item.name,
      label: item.name,
      ordersTop: tier === "top" ? item.orders : 0,
      ordersMid: tier === "mid" ? item.orders : 0,
      ordersRest: tier === "rest" ? item.orders : 0,
      orders: item.orders,
      revenue: item.revenue,
      phoneNumber: item.phoneNumber,
    };
  });

  const series = [
    { dataKey: "ordersTop", label: "Top 5", stack: "orders", color: tierColors.top },
    { dataKey: "ordersMid", label: "6-10", stack: "orders", color: tierColors.mid },
    { dataKey: "ordersRest", label: "11-15", stack: "orders", color: tierColors.rest },
  ];

  return (
    <div className="flex flex-col gap-3">
      <MuiBarChart
        dataset={dataset}
        layout="horizontal"
        height={height}
        margin={{ left: 280, right: 36, top: 10, bottom: 18 }}
        xAxis={[
          {
            label: "Orders",
            valueFormatter: (value: number | null) =>
              value === null ? "" : value.toLocaleString("en-NP"),
          },
        ]}
        yAxis={[
          {
            scaleType: "band",
            dataKey: "label",
            width: 280,
          },
        ]}
        series={series}
        grid={{ horizontal: true, vertical: false }}
        sx={{
          backgroundColor: "transparent",
          "& .MuiChartsAxis-tickLabel": {
            fill: isDark ? "rgba(255,255,255,0.85)" : "rgba(24,24,24,0.7)",
            fontSize: 12,
            fontWeight: 500,
          },
          "& .MuiChartsAxis-line": {
            stroke: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
          },
          "& .MuiChartsAxis-tick": {
            stroke: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
          },
          "& .MuiChartsGrid-line": {
            stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          },
          "& .MuiChartsBarSeries path": {
            rx: 4,
            ry: 4,
          },
        }}
        slotProps={{
          tooltip: {
            trigger: "item",
          },
        }}
      />
      <Legend
        series={[
          { label: "Top 5 customers", color: tierColors.top },
          { label: "6-10 customers", color: tierColors.mid },
          { label: "11-15 customers", color: tierColors.rest },
        ]}
      />
    </div>
  );
}

function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <Stack direction="row" flexWrap="wrap" columnGap={2} justifyContent="center">
      {series.map((aSeries, index) => (
        <Stack key={index} alignItems="center" direction="row" marginBottom={0.5}>
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: aSeries.color,
              marginRight: 8,
              borderRadius: 4,
            }}
          />
          <Typography variant="caption">{aSeries.label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

interface CustomerSpendingChartProps {
  customers: AdminCustomer[];
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
}

export default function CustomerSpendingChart({
  customers,
  timeRange: externalTimeRange,
  onTimeRangeChange,
}: CustomerSpendingChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("revenue");
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("1w");

  const timeRange = externalTimeRange ?? internalTimeRange;
  const setTimeRange = (range: TimeRange) => {
    setInternalTimeRange(range);
    onTimeRangeChange?.(range);
  };

  const chartData = useMemo(() => {
    const normalized = new Map<string, AdminCustomer>();
    customers.forEach((customer) => {
      const first = (customer.firstName ?? "").trim();
      const last = (customer.lastName ?? "").trim();
      const nameKey = `${first} ${last}`.trim().toLowerCase();
      const emailKey = (customer.email ?? "").trim().toLowerCase();
      const phoneKey = (customer.phoneNumber ?? "").trim().replace(/\s+/g, "");
      const key = nameKey || emailKey || phoneKey || customer.id;

      if ((customer.orderCount ?? 0) <= 0) return;

      const existing = normalized.get(key);
      if (!existing) {
        normalized.set(key, customer);
        return;
      }

      const existingOrders = existing.orderCount ?? 0;
      const candidateOrders = customer.orderCount ?? 0;
      const existingRevenue = Number(existing.totalSpent ?? 0);
      const candidateRevenue = Number(customer.totalSpent ?? 0);

      if (
        candidateOrders > existingOrders ||
        (candidateOrders === existingOrders && candidateRevenue > existingRevenue)
      ) {
        normalized.set(key, customer);
      }
    });

    const sorted = Array.from(normalized.values()).sort((a, b) =>
      viewMode === "revenue"
        ? Number(b.totalSpent) - Number(a.totalSpent)
        : b.orderCount - a.orderCount,
    );

    const displayCustomers = sorted.slice(0, 15);

    return displayCustomers.map((c, i) => {
      const name = `${c.firstName} ${c.lastName}`.trim() || c.email || `Customer ${i + 1}`;
      return {
        id: c.id,
        name,
        orders: c.orderCount,
        revenue: Number(c.totalSpent),
        email: c.email,
        phoneNumber: c.phoneNumber,
        profileImageUrl: c.profileImageUrl,
        avatarColor: c.avatarColor,
        firstName: c.firstName,
        lastName: c.lastName,
      };
    }).reverse();
  }, [customers, viewMode]);

  const valueFormatter = (value: number | null) =>
    value !== null ? (viewMode === "revenue" ? formatPrice(value) : `${value}`) : "";

  if (chartData.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-[#E5E5E0] bg-white dark:border-border dark:bg-card">
        <p className="text-sm text-muted-foreground">No customer data to display yet.</p>
      </div>
    );
  }

  const chartHeight = Math.max(400, chartData.length * 40);

  return (
    <div className="rounded-2xl border border-[#E5E5E0] bg-white p-5 dark:border-border dark:bg-card">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Customer Leaderboard
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {TIME_RANGE_LABELS[timeRange]} · {chartData.length} customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E5E5E0] dark:border-border overflow-hidden">
            {(["1w", "1m", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-medium transition-colors uppercase tracking-wider",
                  timeRange === range
                    ? "bg-[#2C5234] text-white"
                    : "bg-white text-muted-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted",
                )}
              >
                {TIME_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-[#E5E5E0] dark:border-border overflow-hidden">
            <button
              onClick={() => setViewMode("revenue")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "revenue"
                  ? "bg-[#2C5234] text-white"
                  : "bg-white text-muted-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted",
              )}
            >
              By Revenue
            </button>
            <button
              onClick={() => setViewMode("orders")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors border-l border-[#E5E5E0] dark:border-border",
                viewMode === "orders"
                  ? "bg-[#2C5234] text-white"
                  : "bg-white text-muted-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted",
              )}
            >
              By Orders
            </button>
          </div>
        </div>
      </div>

      <div className="w-full" style={{ height: chartHeight }}>
        {viewMode === "orders" ? (
          <OrdersRangeBarChart data={chartData} height={chartHeight} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 40, left: 240, bottom: 10 }}
            >
              <defs>
                {chartData.map((_, i) => (
                  <linearGradient key={`revGrad-${i}`} id={`revGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={BAR_GRADIENTS[i % BAR_GRADIENTS.length].from} stopOpacity={0.38} />
                    <stop offset="100%" stopColor={BAR_GRADIENTS[i % BAR_GRADIENTS.length].to} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&_line]:stroke-border" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={valueFormatter}
                className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="id"
                axisLine={false}
                tickLine={false}
                tick={(props) => <CustomerAvatarTick {...props} customers={chartData} />}
                width={240}
              />
              <Tooltip
                content={<CustomTooltip viewMode="revenue" />}
                cursor={{ fill: "rgba(128,128,128,0.08)" }}
              />
              <Bar
                dataKey="revenue"
                radius={[0, 8, 8, 0]}
                barSize={22}
              >
                {chartData.map((_, index) => (
                  <Cell key={`bar-${index}`} fill={`url(#revGrad-${index})`} />
                ))}
              </Bar>
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#d4a843"
                strokeWidth={2}
                fill="rgba(212,168,67,0.06)"
                yAxisId="right"
                dot={{ r: 3, fill: "#d4a843", stroke: "hsl(var(--card))", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "#d4a843", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                type="number"
                hide
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
