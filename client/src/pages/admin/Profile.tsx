import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Camera,
  Expand,
  ImagePlus,
  Shield,
  Bell,
  Activity,
  Laptop,
  AlertTriangle,
  Check,
  Trash2,
  Save,
  RotateCcw,
  ShieldAlert,
  Type,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  persistAdminFontSettings,
  readAdminFontSettings,
  type AdminFontScale,
} from "@/lib/adminFont";

interface ProfileOverview {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    language: string;
    timezone: string;
    department: string;
    role: string;
    adminSince: string | null;
    twoFactorEnabled: boolean;
    loginAlerts: boolean;
    avatarUrl: string | null;
  };
  preferences: {
    compactSidebar: boolean;
    showNPRCurrency: boolean;
    orderAlertSound: boolean;
  };
  notifications: {
    newOrders: boolean;
    lowStock: boolean;
    customerReviews: boolean;
    dailySummary: boolean;
    paymentFailures: boolean;
    marketingReports: boolean;
  };
  stats: {
    ordersManaged: number;
    revenueProcessed: string;
    productsManaged: number;
    stockEntries: number;
    adminActions30d: number;
  };
  accessScope: string[];
  permissions: string[];
  accessOverrides: string[];
  recentActivity: Array<{
    id: string;
    action: string;
    target: string;
    status: number;
    timestamp: string;
  }>;
  orderActivity: Array<{
    id: string;
    billNumber: string;
    orderId: string | null;
    source: string | null;
    customer: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
    items: Array<{ productName?: string; quantity?: number; size?: string; variantColor?: string }>;
    totalAmount: string;
    paymentMethod: string | null;
    paymentVerified: string | null;
    orderStatus: string | null;
    orderCreatedAt: string | null;
    orderUpdatedAt: string | null;
    processedAt: string | null;
    deliveryRequired: boolean;
    deliveryProvider: string | null;
    deliveryAddress: string | null;
    deliveryLocation: string | null;
    linkedOrderEmail: string | null;
    linkedOrderFullName: string | null;
  }>;
  sessions: Array<{
    sid: string;
    isCurrent: boolean;
    expiresAt: string | null;
    createdAt: string | null;
    lastAccessedAt: string | null;
    ip: string | null;
    userAgent: string | null;
  }>;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  timezone: string;
  department: string;
  compactSidebar: boolean;
  showNPRCurrency: boolean;
  orderAlertSound: boolean;
  loginAlerts: boolean;
  notifications: ProfileOverview["notifications"];
}

interface AvatarHistoryItem {
  filename: string;
  url: string;
  uploadedAt: string;
  size: number;
}

const notificationLabels: Array<{ key: keyof ProfileOverview["notifications"]; label: string; description: string }> = [
  { key: "newOrders", label: "New orders", description: "Get notified when a customer places an order." },
  { key: "lowStock", label: "Low stock", description: "Alerts when products run below stock threshold." },
  { key: "customerReviews", label: "Customer reviews", description: "Updates when new product reviews are submitted." },
  { key: "dailySummary", label: "Daily summary", description: "Daily operations digest in one snapshot." },
  { key: "paymentFailures", label: "Payment failures", description: "Immediate alerts for payment verification issues." },
  { key: "marketingReports", label: "Marketing reports", description: "Scheduled campaign and marketing performance reports." },
];

function formatNpr(value: string) {
  const amount = Number(value || "0");
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getInitials(firstName: string, lastName: string, fallbackEmail: string) {
  const candidate = `${firstName} ${lastName}`.trim();
  if (candidate) {
    return candidate
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return fallbackEmail.slice(0, 2).toUpperCase();
}

function buildFormState(overview: ProfileOverview): FormState {
  return {
    firstName: overview.profile.firstName || "",
    lastName: overview.profile.lastName || "",
    email: overview.profile.email || "",
    phone: overview.profile.phone || "",
    language: overview.profile.language || "en",
    timezone: overview.profile.timezone || "Asia/Kathmandu",
    department: overview.profile.department || "",
    compactSidebar: overview.preferences.compactSidebar,
    showNPRCurrency: overview.preferences.showNPRCurrency,
    orderAlertSound: overview.preferences.orderAlertSound,
    loginAlerts: overview.profile.loginAlerts,
    notifications: {
      ...overview.notifications,
    },
  };
}

export default function AdminProfilePage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<null | "reset-2fa" | "signout-all" | "deactivate">(null);
  const [confirmRevokeSessions, setConfirmRevokeSessions] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  const [avatarToDelete, setAvatarToDelete] = useState<AvatarHistoryItem | null>(null);
  const [fontScale, setFontScale] = useState<AdminFontScale>(() => readAdminFontSettings().scale);

  const overviewQuery = useQuery<{ success: boolean; data: ProfileOverview }>({
    queryKey: ["admin", "profile", "overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/profile/overview");
      return (await res.json()) as { success: boolean; data: ProfileOverview };
    },
    enabled: !!user,
  });

  const overview = overviewQuery.data?.data;

  const avatarHistoryQuery = useQuery<AvatarHistoryItem[]>({
    queryKey: ["admin", "profile", "avatar-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/profile/avatar-history");
      const json = (await res.json()) as { success: boolean; data?: AvatarHistoryItem[] };
      return json.data ?? [];
    },
    enabled: !!user,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [initialForm, setInitialForm] = useState<FormState | null>(null);

  if (overview && !form) {
    const next = buildFormState(overview);
    setForm(next);
    setInitialForm(next);
  }

  useEffect(() => {
    if (overview?.profile.avatarUrl && !selectedAvatarUrl) {
      setSelectedAvatarUrl(overview.profile.avatarUrl);
    }
  }, [overview?.profile.avatarUrl, selectedAvatarUrl]);

  const isDirty = useMemo(() => {
    if (!form || !initialForm) return false;
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const validateProfile = () => {
    if (!form) return false;
    const nextErrors: Record<string, string> = {};
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = "Please enter a valid email";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFontScaleChange = (scale: AdminFontScale) => {
    setFontScale(scale);
    const settings = readAdminFontSettings();
    persistAdminFontSettings({ ...settings, scale });
    toast({ title: "Font size updated", description: `Text size set to ${scale.replace("-", " ")}.` });
  };

  useEffect(() => {
    const syncFontScale = () => {
      setFontScale(readAdminFontSettings().scale);
    };
    window.addEventListener("admin-font-settings-updated", syncFontScale);
    window.addEventListener("storage", syncFontScale);
    return () => {
      window.removeEventListener("admin-font-settings-updated", syncFontScale);
      window.removeEventListener("storage", syncFontScale);
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form state");
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        language: form.language.trim(),
        timezone: form.timezone.trim(),
        department: form.department.trim(),
        preferences: {
          compactSidebar: form.compactSidebar,
          showNPRCurrency: form.showNPRCurrency,
          orderAlertSound: form.orderAlertSound,
          loginAlerts: form.loginAlerts,
        },
        notifications: form.notifications,
      };
      const res = await apiRequest("PATCH", "/api/admin/profile", payload);
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      if (!form) return;
      setInitialForm(form);
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile saved", description: "Your changes are live now." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/change-password", {
        current: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirm: passwordForm.confirmPassword,
      });
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordError("");
      toast({ title: "Password changed", description: "Your password was updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Password update failed", description: error.message, variant: "destructive" });
    },
  });

  const securityMutation = useMutation({
    mutationFn: async (payload: { twoFactorEnabled?: boolean; loginAlerts?: boolean }) => {
      const res = await apiRequest("PUT", "/api/admin/profile/security", payload);
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      toast({ title: "Security updated", description: "Security preference saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Security update failed", description: error.message, variant: "destructive" });
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/sessions");
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      toast({ title: "Other sessions revoked", description: "Only this device session remains active." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke sessions", description: error.message, variant: "destructive" });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Unable to read file"));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/admin/profile/upload-avatar", {
        imageBase64: base64,
        provider: "local",
      });
      return (await res.json()) as { success: boolean; url?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "avatar-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Avatar updated", description: "Profile photo uploaded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Avatar upload failed", description: error.message, variant: "destructive" });
    },
  });

  const applyAvatarMutation = useMutation({
    mutationFn: async (profileImageUrl: string) => {
      const res = await apiRequest("PUT", "/api/admin/profile/update", { profileImageUrl });
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile image changed", description: "Selected avatar is now active." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not apply avatar", description: error.message, variant: "destructive" });
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      const res = await apiRequest("DELETE", "/api/admin/profile/avatar", { url: avatarUrl });
      return (await res.json()) as { success: boolean; removedCurrentImage?: boolean };
    },
    onSuccess: (result, avatarUrl) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "avatar-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (selectedAvatarUrl === avatarUrl) {
        setSelectedAvatarUrl(null);
      }
      setAvatarToDelete(null);
      toast({
        title: "Avatar deleted",
        description: result.removedCurrentImage
          ? "Current profile image was removed."
          : "Uploaded avatar removed from library.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not delete avatar", description: error.message, variant: "destructive" });
    },
  });

  const dangerMutation = useMutation({
    mutationFn: async (action: "reset-2fa" | "signout-all" | "deactivate") => {
      const endpoint =
        action === "reset-2fa"
          ? "/api/admin/profile/reset-2fa"
          : action === "signout-all"
            ? "/api/admin/profile/signout-all"
            : "/api/admin/profile/deactivate";
      const res = await apiRequest("POST", endpoint);
      return (await res.json()) as { success: boolean };
    },
    onSuccess: (_, action) => {
      if (action === "deactivate" || action === "signout-all") {
        window.location.href = "/admin/login";
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "overview"] });
      toast({ title: "2FA reset", description: "Two-factor authentication has been reset." });
    },
    onError: (error: Error) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  if (overviewQuery.isLoading || !overview || !form) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Profile</h1>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading profile...</CardContent>
        </Card>
      </div>
    );
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim() || overview.profile.email;
  const avatarHistory = avatarHistoryQuery.data ?? [];

  const handleSave = () => {
    if (!validateProfile()) {
      toast({ title: "Validation failed", description: "Please resolve highlighted fields.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const handleDiscard = () => {
    if (!initialForm) return;
    setForm(initialForm);
    setFormErrors({});
  };

  const handlePasswordSubmit = () => {
    setPasswordError("");
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Password confirmation does not match.");
      return;
    }
    changePasswordMutation.mutate();
  };

  const sectionCardClass =
    "border-border/70 bg-card/95 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.3)] dark:shadow-[0_12px_34px_-22px_rgba(0,0,0,0.55)]";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-[2.15rem] font-serif font-medium tracking-[0.01em] text-foreground">
          Account Profile
        </h1>
        <p className="text-sm text-muted-foreground">Manage your admin account settings and access controls.</p>
      </div>

      <Card className={cn("overflow-hidden", sectionCardClass)}>
        <div className="relative h-36 border-b bg-[linear-gradient(135deg,rgba(20,20,24,0.08),rgba(201,168,76,0.16),rgba(85,136,221,0.12),transparent)] dark:bg-[linear-gradient(135deg,rgba(20,20,24,0.95),rgba(201,168,76,0.2),rgba(85,136,221,0.2),rgba(0,0,0,0.85))]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(201,168,76,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(201,168,76,0.08)_1px,transparent_1px)] bg-[size:36px_36px] opacity-30 dark:opacity-25" />
        </div>
        <CardContent className="pt-0">
          <div className="-mt-16 flex flex-col gap-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAvatarUrl(overview.profile.avatarUrl || selectedAvatarUrl || null);
                    setIsAvatarDialogOpen(true);
                  }}
                  data-testid="profile-avatar-trigger"
                  className="group relative h-32 w-32 overflow-hidden rounded-full border-[4px] border-background bg-muted shadow-[0_10px_26px_-14px_rgba(0,0,0,0.45)] transition-all hover:scale-[1.01]"
                >
                  {overview.profile.avatarUrl ? (
                    <img
                      src={overview.profile.avatarUrl}
                      alt="Profile"
                      data-testid="profile-avatar-image"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                      {getInitials(form.firstName, form.lastName, form.email)}
                    </span>
                  )}
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
                    <Expand className="h-4 w-4" />
                  </span>
                  <span className="absolute bottom-1 right-1 inline-flex h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  data-testid="profile-avatar-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) avatarMutation.mutate(file);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="space-y-2 pb-1">
                  <h2 className="text-[1.8rem] font-serif leading-none tracking-[0.02em]">{fullName}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="uppercase text-[10px] tracking-[0.14em] rounded-full px-2.5">
                      {overview.profile.role}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-[10px] uppercase tracking-[0.12em] rounded-full px-2.5">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">{form.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-full px-4 font-semibold"
                  loading={avatarMutation.isPending}
                  loadingText="Uploading..."
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-3.5 w-3.5" />
                  Upload Image
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full px-4 font-semibold"
                  onClick={() => {
                    setSelectedAvatarUrl(overview.profile.avatarUrl || selectedAvatarUrl || null);
                    setIsAvatarDialogOpen(true);
                  }}
                >
                  <Expand className="mr-2 h-3.5 w-3.5" />
                  View & Change
                </Button>
              </div>
            </div>

            <div className="grid gap-0 border-t border-border/70 pt-1 sm:grid-cols-2 xl:grid-cols-4">
              <div className="p-4 sm:p-5 xl:border-r xl:border-border/70" data-testid="profile-stat-orders">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Orders Managed</p>
                <p className="mt-2 text-3xl font-serif leading-none">{overview.stats.ordersManaged}</p>
              </div>
              <div className="p-4 sm:p-5 xl:border-r xl:border-border/70" data-testid="profile-stat-revenue">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Revenue Processed</p>
                <p className="mt-2 text-3xl font-serif leading-none">{formatNpr(overview.stats.revenueProcessed)}</p>
              </div>
              <div className="p-4 sm:p-5 xl:border-r xl:border-border/70" data-testid="profile-stat-products">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Products Managed</p>
                <p className="mt-2 text-3xl font-serif leading-none">{overview.stats.productsManaged}</p>
              </div>
              <div className="p-4 sm:p-5" data-testid="profile-stat-actions">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Admin Actions (30d)</p>
                <p className="mt-2 text-3xl font-serif leading-none">{overview.stats.adminActions30d}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className={cn("xl:col-span-2", sectionCardClass)}>
          <CardHeader>
            <CardTitle className="font-serif text-xl tracking-[0.02em]">Personal Information</CardTitle>
            <CardDescription>Edit your core account details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input
                id="profile-first-name"
                data-testid="profile-first-name-input"
                value={form.firstName}
                onChange={(event) => {
                  setForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev));
                  setFormErrors((prev) => ({ ...prev, firstName: "" }));
                }}
              />
              {formErrors.firstName ? <p className="text-xs text-red-500">{formErrors.firstName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input
                id="profile-last-name"
                data-testid="profile-last-name-input"
                value={form.lastName}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                data-testid="profile-email-input"
                type="email"
                value={form.email}
                onChange={(event) => {
                  setForm((prev) => (prev ? { ...prev, email: event.target.value } : prev));
                  setFormErrors((prev) => ({ ...prev, email: "" }));
                }}
              />
              {formErrors.email ? <p className="text-xs text-red-500">{formErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-language">Language</Label>
              <Input
                id="profile-language"
                value={form.language}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, language: event.target.value } : prev))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-timezone">Timezone</Label>
              <Input
                id="profile-timezone"
                value={form.timezone}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="font-serif text-xl tracking-[0.02em]">Role & Access</CardTitle>
            <CardDescription>Read-only role data and scope mapping.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role</p>
              <p className="mt-1 font-medium">{overview.profile.role}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-department">Department</Label>
              <Input
                id="profile-department"
                value={form.department}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, department: event.target.value } : prev))}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Admin since</p>
              <p className="mt-1 text-sm">{overview.profile.adminSince ? new Date(overview.profile.adminSince).toLocaleDateString() : "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Access scope</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overview.accessScope.map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-[10px] uppercase">
                    {scope.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl tracking-[0.02em]"><Shield className="h-4 w-4" /> Preferences</CardTitle>
            <CardDescription>UI and workflow preferences for your admin workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Compact Sidebar</p>
                <p className="text-xs text-muted-foreground">Tighter navigation spacing in admin sidebar.</p>
              </div>
              <Switch
                checked={form.compactSidebar}
                onCheckedChange={(checked) => setForm((prev) => (prev ? { ...prev, compactSidebar: checked } : prev))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show NPR Currency</p>
                <p className="text-xs text-muted-foreground">Display NPR as the default financial format.</p>
              </div>
              <Switch
                checked={form.showNPRCurrency}
                onCheckedChange={(checked) => setForm((prev) => (prev ? { ...prev, showNPRCurrency: checked } : prev))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Alert Sound</p>
                <p className="text-xs text-muted-foreground">Play sound cue when new order events arrive.</p>
              </div>
              <Switch
                checked={form.orderAlertSound}
                onCheckedChange={(checked) => setForm((prev) => (prev ? { ...prev, orderAlertSound: checked } : prev))}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Font Size</p>
              </div>
              <p className="text-xs text-muted-foreground">Adjust the text size across the admin panel.</p>
              <Select value={fontScale} onValueChange={handleFontScaleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="very-large">Very Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl tracking-[0.02em]"><ShieldAlert className="h-4 w-4" /> Security</CardTitle>
            <CardDescription>Password and account protection settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="profile-current-password">Current Password</Label>
                <Input
                  id="profile-current-password"
                  data-testid="profile-password-current"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">New Password</Label>
                <Input
                  id="profile-new-password"
                  data-testid="profile-password-new"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm-password">Confirm Password</Label>
                <Input
                  id="profile-confirm-password"
                  data-testid="profile-password-confirm"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
              </div>
              {passwordError ? (
                <p className="text-xs text-red-500" data-testid="profile-password-error">{passwordError}</p>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  data-testid="profile-password-save"
                  onClick={handlePasswordSubmit}
                  loading={changePasswordMutation.isPending}
                  loadingText="Updating..."
                >
                  Update Password
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Require OTP challenge for sign-in.</p>
              </div>
              <Switch
                checked={overview.profile.twoFactorEnabled}
                onCheckedChange={(checked) => securityMutation.mutate({ twoFactorEnabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Login Alerts</p>
                <p className="text-xs text-muted-foreground">Receive alerts when your account signs in.</p>
              </div>
              <Switch
                checked={form.loginAlerts}
                onCheckedChange={(checked) => {
                  setForm((prev) => (prev ? { ...prev, loginAlerts: checked } : prev));
                  securityMutation.mutate({ loginAlerts: checked });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={sectionCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl tracking-[0.02em]"><Bell className="h-4 w-4" /> Notification Preferences</CardTitle>
          <CardDescription>Configure operational alert channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {notificationLabels.map((item) => (
            <div key={item.key} className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  data-testid={`profile-notification-${item.key}`}
                  checked={form.notifications[item.key]}
                  onCheckedChange={(checked) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            notifications: { ...prev.notifications, [item.key]: checked },
                          }
                        : prev,
                    )
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="font-serif text-xl tracking-[0.02em]">Order Activity</CardTitle>
            <CardDescription>Orders and bills processed from your admin account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.orderActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No processed order activity found yet.</p>
            ) : (
              overview.orderActivity.map((entry) => (
                <div key={entry.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {entry.billNumber}
                      {entry.orderId ? ` • ${entry.orderId}` : ""}
                    </p>
                    <Badge variant="outline" className="capitalize">
                      {entry.orderStatus || entry.source || "processed"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.customer.name || entry.linkedOrderFullName || "Customer"} • {entry.customer.email || entry.linkedOrderEmail || "No email"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.items.map((item) => `${item.productName || "Item"} x${item.quantity || 0}`).join(", ")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Total {formatNpr(entry.totalAmount)} • Processed {entry.processedAt ? new Date(entry.processedAt).toLocaleString() : "-"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="font-serif text-xl tracking-[0.02em]">Module Permissions</CardTitle>
            <CardDescription>Read-only permissions inherited from your current role.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2" data-testid="profile-permissions-grid">
              {overview.permissions.map((moduleKey) => (
                <div key={moduleKey} className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <p className="text-sm font-medium capitalize" data-testid={`profile-permission-${moduleKey}`}>{moduleKey.replace(/-/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">Read-only scope mapping</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl tracking-[0.02em]"><Activity className="h-4 w-4" /> Recent Activity</CardTitle>
            <CardDescription>Last 10 actions recorded for your admin account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity found yet.</p>
            ) : (
              overview.recentActivity.map((entry) => (
                <div key={entry.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">Status {entry.status} • {new Date(entry.timestamp).toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={sectionCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl tracking-[0.02em]"><Laptop className="h-4 w-4" /> Active Sessions</CardTitle>
          <CardDescription>Review active authenticated sessions and revoke others.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.sessions.map((session) => (
            <div key={session.sid} className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", session.isCurrent ? "border-primary" : "")}> 
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{session.isCurrent ? "Current Session" : "Active Session"}</p>
                  <p className="text-xs text-muted-foreground">{session.ip || "Unknown IP"} • expires {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "-"}</p>
                </div>
                {session.isCurrent ? <Badge>Current</Badge> : <Badge variant="outline">Other</Badge>}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="profile-revoke-others"
              variant="outline"
              onClick={() => setConfirmRevokeSessions(true)}
              loading={revokeSessionsMutation.isPending}
              loadingText="Revoking..."
            >
              Revoke All Others
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200/80 bg-red-50/35 shadow-[0_8px_26px_-20px_rgba(220,38,38,0.45)] dark:border-red-900/60 dark:bg-red-950/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Danger Zone</CardTitle>
          <CardDescription>High-impact account actions. Confirmation is required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmAction("reset-2fa")}>Reset 2FA</Button>
            <Button type="button" variant="outline" onClick={() => setConfirmAction("signout-all")}>Sign Out All</Button>
            <Button type="button" data-testid="profile-danger-deactivate" variant="destructive" onClick={() => setConfirmAction("deactivate")}>Deactivate Account</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-[420px] bg-muted/40 p-6 sm:p-8 flex items-center justify-center">
              {selectedAvatarUrl ? (
                <img
                  src={selectedAvatarUrl}
                  alt="Avatar preview"
                  className="max-h-[72vh] max-w-full rounded-2xl border object-contain bg-background"
                />
              ) : (
                <div className="flex h-[300px] w-full max-w-[380px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  No image selected
                </div>
              )}
            </div>
            <div className="border-l p-5">
              <DialogHeader>
                <DialogTitle>Profile Image</DialogTitle>
                <DialogDescription>
                  Upload new, preview full-size, and choose from your recent uploads.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  loading={avatarMutation.isPending}
                  loadingText="Uploading..."
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload New
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!selectedAvatarUrl || selectedAvatarUrl === overview.profile.avatarUrl}
                  loading={applyAvatarMutation.isPending}
                  loadingText="Applying..."
                  onClick={() => selectedAvatarUrl && applyAvatarMutation.mutate(selectedAvatarUrl)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Use This Image
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={!selectedAvatarUrl || !selectedAvatarUrl.startsWith("/uploads/avatars/")}
                  onClick={() => {
                    const match = avatarHistory.find((item) => item.url === selectedAvatarUrl);
                    if (match) setAvatarToDelete(match);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Recent Uploads
                </p>
                <div className="mt-2 grid max-h-[380px] gap-2 overflow-y-auto pr-1">
                  {avatarHistoryQuery.isLoading ? (
                    <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                      Loading uploads...
                    </div>
                  ) : avatarHistory.length === 0 ? (
                    <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                      No uploaded images yet.
                    </div>
                  ) : (
                    avatarHistory.map((item) => (
                      <button
                        type="button"
                        key={item.filename}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                          selectedAvatarUrl === item.url
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/60",
                        )}
                        onClick={() => setSelectedAvatarUrl(item.url)}
                      >
                        <img
                          src={item.url}
                          alt="Recent avatar"
                          className="h-12 w-12 rounded-md border object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{item.filename}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(item.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsAvatarDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isDirty ? (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-5xl rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">You have unsaved changes</p>
              <p className="text-xs text-muted-foreground">Save to persist profile, preference, and notification updates.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleDiscard}>
                <RotateCcw className="mr-2 h-4 w-4" /> Discard
              </Button>
              <Button type="button" data-testid="profile-save" onClick={handleSave} loading={saveMutation.isPending} loadingText="Saving...">
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reset-2fa" && "This will disable 2FA for your account until you enable it again."}
              {confirmAction === "signout-all" && "This will sign you out from all devices, including this one."}
              {confirmAction === "deactivate" && "This will deactivate your account and sign you out immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="profile-danger-cancel" onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="profile-danger-confirm"
              onClick={(event) => {
                event.preventDefault();
                if (!confirmAction) return;
                dangerMutation.mutate(confirmAction);
                setConfirmAction(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRevokeSessions} onOpenChange={setConfirmRevokeSessions}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke other sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This signs out all sessions except your current device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmRevokeSessions(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="profile-revoke-confirm"
              onClick={(event) => {
                event.preventDefault();
                revokeSessionsMutation.mutate();
                setConfirmRevokeSessions(false);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!avatarToDelete} onOpenChange={(open) => !open && setAvatarToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this uploaded image?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the image from your local avatar history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAvatarToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!avatarToDelete) return;
                deleteAvatarMutation.mutate(avatarToDelete.url);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
