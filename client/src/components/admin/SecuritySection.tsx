import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, 
  Activity, 
  AlertOctagon, 
  FileText, 
  Settings, 
  Terminal,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SecurityLog {
  id: string;
  userId: string | null;
  userRole: string | null;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  ip: string | null;
  threat: string | null;
  createdAt: string;
}

export default function SecuritySection() {
  const [isLive, setIsLive] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);

  // Stats persistence (local storage)
  const [showAlerts, setShowAlerts] = useState(() => {
    return localStorage.getItem("rare_security_alerts") !== "false";
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const { data: logsData, isLoading: logsLoading } = useQuery<{ success: boolean; data: SecurityLog[] }>({
    queryKey: ["admin", "security", "logs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/logs/recent");
      return res.json();
    },
    refetchInterval: isLive && isTabActive ? 3000 : false,
  });

  const logs = logsData?.data ?? [];

  const stats = {
    totalRequests: logs.length,
    threatsDetected: logs.filter(l => l.threat).length,
    avgLatency: logs.length > 0 
      ? Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / logs.length) 
      : 0,
    activeAdminSessions: new Set(logs.filter(l => l.userRole === "admin").map(l => l.userId)).size,
  };

  const getStatusColor = (status: number) => {
    if (status >= 500) return "text-red-500 bg-red-500/10 border-red-500/20";
    if (status >= 400) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    if (status >= 300) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    return "text-green-500 bg-green-500/10 border-green-500/20";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header with Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border-[#E5E5E0] dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Requests (Recent)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">{stats.totalRequests}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Real-time log count</p>
          </CardContent>
        </Card>
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border-[#E5E5E0] dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Threats Flagged</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif text-red-600 dark:text-red-400">{stats.threatsDetected}</div>
            <p className="text-[10px] text-muted-foreground mt-1 text-red-500/80">Require immediate audit</p>
          </CardContent>
        </Card>
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border-[#E5E5E0] dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">{stats.avgLatency}ms</div>
            <p className="text-[10px] text-muted-foreground mt-1">API performance metric</p>
          </CardContent>
        </Card>
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border-[#E5E5E0] dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Active Admins</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">{stats.activeAdminSessions}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Concurrent management</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Traffic Monitor */}
        <Card className="lg:col-span-2 bg-white dark:bg-card border-[#E5E5E0] dark:border-border overflow-hidden">
          <CardHeader className="border-b border-[#F0F0EB] dark:border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold tracking-wider flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live Log Monitor
                </CardTitle>
                <CardDescription className="text-xs">Incoming API requests (3s poll)</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-tighter uppercase">
                   <span className={cn("w-1.5 h-1.5 rounded-full", isLive && isTabActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground")}></span>
                   {isLive && isTabActive ? "Streaming" : "Paused"}
                </div>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-7 w-7 p-0" 
                   onClick={() => setIsLive(!isLive)}
                >
                  {isLive ? <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto font-mono text-[11px] divide-y divide-[#F0F0EB] dark:divide-border/50">
              {logsLoading && logs.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground italic">
                  Initializing log stream...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground italic">
                  No requests captured in the last window.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={cn("p-2 transition-colors hover:bg-muted/30 flex items-center gap-3", log.threat && "bg-red-500/5")}>
                    <div className="w-16 shrink-0 text-muted-foreground text-[10px]">
                      {format(new Date(log.createdAt), "HH:mm:ss")}
                    </div>
                    <div className="w-12 shrink-0 font-bold">
                      {log.method}
                    </div>
                    <div className="flex-1 truncate text-foreground font-medium">
                      {log.url}
                    </div>
                    <div className="w-16 shrink-0 text-center">
                      <Badge variant="outline" className={cn("text-[9px] font-mono px-1.5 py-0", getStatusColor(log.status))}>
                        {log.status}
                      </Badge>
                    </div>
                    <div className="w-12 shrink-0 text-right text-muted-foreground">
                      {log.durationMs}ms
                    </div>
                    {log.threat && (
                      <div className="shrink-0 text-red-500 animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <Card className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Audit Reports
              </CardTitle>
              <CardDescription className="text-xs">Export snapshots for compliance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Generate a full security audit containing all flagged events and admin interactions for the last 24 hours.
                  </p>
                  <Button className="w-full h-8 text-xs font-semibold tracking-tighter" variant="outline">
                    <Download className="h-3 w-3 mr-2" />
                    Download Snapshot (PDF)
                  </Button>
               </div>
               <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Raw JSON dump of the last 1,000 requests for external analysis.
                  </p>
                  <Button className="w-full h-8 text-xs font-semibold tracking-tighter" variant="outline" onClick={() => {
                    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `rare-security-logs-${Date.now()}.json`;
                    a.click();
                  }}>
                    <FileText className="h-3 w-3 mr-2" />
                    Export Raw JSON
                  </Button>
               </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Security Settings
              </CardTitle>
              <CardDescription className="text-xs">Configure UI behaviors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Visual Alerts</label>
                  <p className="text-[10px] text-muted-foreground">Pulse red on security threats</p>
                </div>
                <Switch 
                  checked={showAlerts} 
                  onCheckedChange={(val) => {
                    setShowAlerts(val);
                    localStorage.setItem("rare_security_alerts", String(val));
                  }} 
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Auto-Refresh Stats</label>
                  <p className="text-[10px] text-muted-foreground">Background KPI updates (30s)</p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Flagged Events */}
      <Card className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-wider flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            Recent Flagged Events
          </CardTitle>
          <CardDescription className="text-xs text-orange-600/80 dark:text-orange-400/80">Filter of suspicious activity detected by the application layer</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t border-border">
          <table className="w-full text-[11px] text-left">
             <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border uppercase tracking-widest">
                <tr>
                   <th className="px-6 py-3 font-semibold">Event</th>
                   <th className="px-6 py-3 font-semibold">Origin</th>
                   <th className="px-6 py-3 font-semibold">Severity</th>
                   <th className="px-6 py-3 font-semibold">Time</th>
                   <th className="px-6 py-3 text-right font-semibold">Resolution</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-border">
                {logs.filter(l => l.threat).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                       No security threats detected in the current log buffet.
                    </td>
                  </tr>
                ) : (
                  logs.filter(l => l.threat).map((threat) => (
                    <tr key={threat.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-red-500">{threat.threat}</div>
                        <div className="text-[10px] text-muted-foreground">{threat.url}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {threat.ip || "Unknown"}
                      </td>
                      <td className="px-6 py-4">
                         <Badge variant="default" className="bg-red-500 text-[9px]">High</Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(threat.createdAt), "MMM d, HH:mm")}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <Button variant="ghost" size="sm" className="h-7 text-[10px]">Mark Resolved</Button>
                      </td>
                    </tr>
                  ))
                )}
             </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-10 py-6 border-t border-[#F0F0EB] dark:border-border mt-10">
         <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> AES-256 Storage
         </div>
         <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Real-time Audit
         </div>
         <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Role-based Access
         </div>
      </div>
    </div>
  );
}
