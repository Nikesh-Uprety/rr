import { useMemo } from "react";
import {
  LineChart,
  LineChartProps,
  lineElementClasses,
  markElementClasses,
} from "@mui/x-charts/LineChart";
import {
  ChartsLabelCustomMarkProps,
} from "@mui/x-charts/ChartsLabel";
import type { AdminOrder } from "@/lib/adminApi";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";

function Line({ className, color }: ChartsLabelCustomMarkProps) {
  return (
    <svg viewBox="0 0 24 4">
      <line
        className={className}
        x1={0}
        y1={2}
        x2={24}
        y2={2}
        stroke={color}
        strokeWidth={2}
      />
    </svg>
  );
}

interface OrdersTrendChartProps {
  orders: AdminOrder[];
  timeRange?: "1d" | "3d" | "7d" | "30d" | "all";
}

export default function OrdersTrendChart({ orders, timeRange = "7d" }: OrdersTrendChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    let days: number;
    if (timeRange === "all") {
      if (orders.length === 0) return null;
      const oldest = new Date(orders[orders.length - 1].createdAt);
      days = Math.max(1, Math.ceil((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      days = timeRange === "1d" ? 1 : timeRange === "3d" ? 3 : timeRange === "30d" ? 30 : 7;
    }

    const startDate = startOfDay(subDays(now, days - 1));
    const endDate = startOfDay(now);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyData = dateRange.map((day) => {
      const dayStr = format(day, "MMM dd");
      const dayOrders = orders.filter((o) => {
        const d = startOfDay(new Date(o.createdAt));
        return d.getTime() === day.getTime();
      });
      const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      const completed = dayOrders.filter((o) => o.status === "completed").length;
      const pending = dayOrders.filter((o) => o.status === "pending").length;
      return { day: dayStr, revenue, completed, pending, total: dayOrders.length };
    });

    return dailyData;
  }, [orders, timeRange]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-[#E5E5E0] bg-white dark:border-border dark:bg-card">
        <p className="text-sm text-muted-foreground">No order data to display yet.</p>
      </div>
    );
  }

  const settings: LineChartProps = {
    series: [
      {
        data: chartData.map((d) => d.revenue),
        label: "Revenue",
        id: "revenue",
        labelMarkType: Line,
        color: "#2C5234",
      },
      {
        data: chartData.map((d) => d.total),
        label: "Orders",
        id: "orders",
        labelMarkType: Line,
        color: "#81a074",
      },
    ],
    xAxis: [
      {
        scaleType: "point",
        data: chartData.map((d) => d.day),
      },
    ],
    yAxis: [
      {
        width: 90,
        valueFormatter: (value: number | null) => {
          if (value === null) return "";
          return value.toLocaleString("en-NP");
        },
      },
    ],
    height: 300,
    margin: { left: 90, right: 24, top: 10, bottom: 10 },
    sx: {
      backgroundColor: "transparent",
      [`.${lineElementClasses.root}, .${markElementClasses.root}`]: {
        strokeWidth: 2,
      },
      [`.${lineElementClasses.root}[data-series="revenue"]`]: {
        strokeDasharray: "none",
      },
      [`.${lineElementClasses.root}[data-series="orders"]`]: {
        strokeDasharray: "5 5",
      },
    },
  };

  return (
    <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4 dark:border-border dark:bg-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Orders & Revenue Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {timeRange === "all" ? "All time" : `Last ${timeRange}`} • {chartData.length} days
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-[2px] bg-[#2C5234]" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-[2px] bg-[#81a074]" style={{ borderTop: "1px dashed #81a074" }} />
            <span className="text-muted-foreground">Orders</span>
          </div>
        </div>
      </div>
      <LineChart {...settings} />
    </div>
  );
}
