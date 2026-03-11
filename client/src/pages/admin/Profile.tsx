import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  type AdminCustomer,
  type AdminOrder,
  exportSubscribersCSV,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";
import { 
  Search, 
  Mail, 
  MessageSquare, 
  Send, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  ChevronRight,
  Reply,
  Download,
  Users,
  FileSpreadsheet
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  status: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  createdAt: string;
}

export default function AdminProfilePage() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get("tab") || "account";

  const [activeTab, setActiveTab] = useState(initialTab);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const {
    data: adminUsers = [],
    isLoading: usersLoading,
  } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      const json = (await res.json()) as {
        success: boolean;
        data?: AdminUser[];
      };
      return json.data ?? [];
    },
    enabled: !!user,
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/profile/password", {
        current: passwordCurrent,
        newPassword: passwordNew,
        confirm: passwordConfirm,
      });
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          title: "Password not updated",
          description: result.error ?? "Please check your inputs.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Password updated",
        description: "Your password has been changed.",
      });
      setPasswordCurrent("");
      setPasswordNew("");
      setPasswordConfirm("");
    },
    onError: (err: Error) => {
      toast({
        title: "Password not updated",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const twoFAMutation = useMutation({
    mutationFn: async ({
      id,
      enabled,
    }: {
      id: string;
      enabled: boolean;
    }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}/2fa`, {
        enabled,
      });
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          title: "Could not update 2FA",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Two-factor updated",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not update 2FA",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          title: "Could not revoke access",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "Access revoked",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not revoke access",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      email: string;
      role: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/users/invite", payload);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result, variables) => {
      if (!result.success) {
        toast({
          title: "Invite not sent",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "Invite sent",
        description: `Invite sent to ${variables.email}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Invite not sent",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");

  // Messages State
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplyOpen, setIsReplyOpen] = useState(false);

  // Marketing State
  const [marketingSubject, setMarketingSubject] = useState("New Seasonal Collection — RARE ATELIER");
  const [marketingBody, setMarketingBody] = useState(`<div style="font-family: 'serif', 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #07060a; color: #f2efe8; text-align: center;">
  <h1 style="font-size: 32px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #f2efe8;">RARE ATELIER</h1>
  <div style="width: 40px; height: 1px; background: rgba(242, 239, 232, 0.3); margin: 0 auto 32px;"></div>
  
  <h2 style="font-size: 24px; font-style: italic; margin-bottom: 16px;">The Latest from the Atelier</h2>
  
  <p style="font-size: 16px; line-height: 1.6; color: rgba(242, 239, 232, 0.7); margin-bottom: 32px; text-align: left;">
    Dear community,
    <br><br>
    [Edit your message here...]
  </p>
  
  <div style="margin: 40px 0; padding: 32px; border: 1px solid rgba(242, 239, 232, 0.1);">
     <p style="font-size: 14px; color: #f2efe8; letter-spacing: 0.1em; margin-bottom: 24px;">EXPLORE THE ARCHIVE</p>
     <a href="https://rarenp.com" style="display: inline-block; padding: 14px 28px; background: #f2efe8; color: #07060a; text-decoration: none; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;">Shop Now</a>
  </div>

  <div style="margin-top: 60px; padding-top: 32px; border-top: 1px solid rgba(242, 239, 232, 0.1);">
    <p style="font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242, 239, 232, 0.4);">
      RARE Nepal · Kathmandu · Heritage Meets Future
    </p>
    <div style="margin-top: 16px;">
       <a href="#" style="color: rgba(242, 239, 232, 0.4); text-decoration: underline; font-size: 10px;">Unsubscribe</a>
    </div>
  </div>
</div>`);
  const [subscriberSearch, setSubscriberSearch] = useState("");

  // Queries
  const messagesQuery = useQuery<{ success: boolean; data: ContactMessage[] }>({
    queryKey: ["admin", "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/messages");
      return res.json();
    },
    enabled: !!user,
  });

  const subscribersQuery = useQuery<{ success: boolean; data: { email: string; createdAt: string }[] }>({
    queryKey: ["admin", "newsletter", "subscribers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/newsletter/subscribers");
      return res.json();
    },
    enabled: !!user,
  });

  const subscribersLoading = subscribersQuery.isLoading;

  const messages = messagesQuery.data?.data ?? [];
  const subscribers = subscribersQuery.data?.data ?? [];
  const filteredSubscribers = subscribers.filter(s => 
    s.email.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

  const replyMutation = useMutation({
    mutationFn: async (payload: { id: string; to: string; subject: string; html: string }) => {
      const res = await apiRequest("POST", `/api/admin/messages/${payload.id}/reply`, payload);
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Reply sent successfully" });
        setIsReplyOpen(false);
        setReplyText("");
        queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      } else {
        toast({ title: "Failed to send reply", variant: "destructive" });
      }
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (payload: { subject: string; html: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/broadcast", payload);
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: `Broadcast sent to ${result.count} subscribers` });
        setMarketingSubject("");
        setMarketingBody("");
      } else {
        toast({ title: result.error || "Failed to send broadcast", variant: "destructive" });
      }
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/test-email", { email });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Test email sent!", description: result.message });
      } else {
        toast({ title: "Failed to send test email", description: result.error, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, security, and admin team.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">All Admin Users</TabsTrigger>}
          {isAdmin && <TabsTrigger value="invite">Create User</TabsTrigger>}
          <TabsTrigger value="messages" className="relative">
            Messages
            {messages.some(m => m.status === 'unread') && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
            )}
          </TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        {/* Account tab */}
        <TabsContent value="account" className="mt-4">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-[#2D4A35] text-white flex items-center justify-center text-2xl font-semibold">
                {(user?.name || user?.email || "U")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <Badge variant="outline" className="text-[11px]">
                {user?.role === "admin" ? "ADMIN" : "STAFF"}
              </Badge>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Display name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Email
                </label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="h-10 bg-muted/40"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled
                  className="h-10"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  SMTP Diagnostics
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a test email to verify your SMTP configuration.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={testEmailMutation.isPending}
                onClick={() => testEmailMutation.mutate("upretynikesh021@gmail.com")}
              >
                {testEmailMutation.isPending ? "Sending..." : "Send Test to upretynikesh021@gmail.com"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4 space-y-6">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Reset Password
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  New Password
                </label>
                <Input
                  type="password"
                  value={passwordNew}
                  onChange={(e) => setPasswordNew(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="h-9"
                disabled={passwordMutation.isPending}
                onClick={() => passwordMutation.mutate()}
              >
                Update Password
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Two-Factor Authentication
                </h2>
                <p className="text-xs text-muted-foreground">
                  When enabled, you&apos;ll receive a 6-digit code on your email
                  every time you log in from a new device.
                </p>
              </div>
              <Switch
                checked={!!user?.twoFactorEnabled}
                onCheckedChange={(enabled) => {
                  if (!user) return;
                  twoFAMutation.mutate({ id: user.id, enabled });
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* All Admin Users tab */}
        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Admin Users
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[#E5E5E0] dark:border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 text-left font-semibold">
                        User
                      </th>
                      <th className="py-2 pr-4 text-left font-semibold">
                        Role
                      </th>
                      <th className="py-2 pr-4 text-left font-semibold">
                        2FA
                      </th>
                      <th className="py-2 pr-4 text-left font-semibold">
                        Last Login
                      </th>
                      <th className="py-2 pl-2 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading &&
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3 pr-4">
                            <div className="h-3 w-24 bg-muted animate-pulse rounded mb-1" />
                            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <div className="h-7 w-20 bg-muted animate-pulse rounded-full ml-auto" />
                          </td>
                        </tr>
                      ))}
                    {!usersLoading &&
                      adminUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[#F0F0EB]">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-[12px]">
                              {u.name || u.email}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {u.email}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {u.role.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-[11px]">
                              {u.twoFactorEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-[11px] text-muted-foreground">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString(
                                  "en-NP",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className="py-3 pl-2 text-right">
                            {u.id !== user?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => revokeMutation.mutate(u.id)}
                              >
                                Revoke Access
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    {!usersLoading && adminUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-xs text-muted-foreground"
                        >
                          No admin users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Create User tab */}
        {isAdmin && (
          <TabsContent value="invite" className="mt-4">
            <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Invite Admin User
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                    Full Name
                  </label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Full name"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value === "admin" ? "admin" : "staff",
                      )
                    }
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={inviteMutation.isPending}
                  onClick={() =>
                    inviteMutation.mutate({
                      name: inviteName,
                      email: inviteEmail,
                      role: inviteRole,
                    })
                  }
                >
                  Send Invite
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Messages tab */}
        <TabsContent value="messages" className="mt-4">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border overflow-hidden">
            <div className="p-4 border-b border-[#E5E5E0] dark:border-border bg-muted/30">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Customer Inquiries
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.18em] text-muted-foreground border-b border-[#E5E5E0] dark:border-border">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Sender</th>
                    <th className="px-6 py-3 font-semibold">Subject</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0EB] dark:divide-border">
                  {messagesQuery.isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                         <td colSpan={5} className="px-6 py-4 animate-pulse">
                           <div className="h-4 bg-muted rounded w-full" />
                         </td>
                      </tr>
                    ))
                  ) : messages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                        No contact messages found.
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg) => (
                      <tr key={msg.id} className={cn("hover:bg-muted/20 transition-colors", msg.status === 'unread' && "bg-blue-50/30 dark:bg-blue-900/10")}>
                        <td className="px-6 py-4">
                          {msg.status === 'replied' ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Replied</Badge>
                          ) : msg.status === 'unread' ? (
                            <Badge variant="default" className="text-[10px] bg-blue-600">New</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Read</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[12px]">{msg.name}</div>
                          <div className="text-[11px] text-muted-foreground">{msg.email}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="font-medium text-[12px] truncate">{msg.subject}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{msg.message}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedMessage(msg);
                              setIsReplyOpen(true);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Reply to {selectedMessage?.name}</DialogTitle>
                <DialogDescription>
                  Send a response to {selectedMessage?.email}
                </DialogDescription>
              </DialogHeader>
              
              {selectedMessage && (
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted/40 rounded-lg text-sm border border-border">
                    <p className="font-semibold mb-2">Original Message — {selectedMessage.subject}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Your Response</label>
                    <Textarea 
                      placeholder="Type your reply here..." 
                      className="min-h-[150px] resize-none"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
                <Button 
                  disabled={replyMutation.isPending || !replyText.trim()}
                  onClick={() => {
                    if (!selectedMessage) return;
                    replyMutation.mutate({
                      id: selectedMessage.id,
                      to: selectedMessage.email,
                      subject: `Re: ${selectedMessage.subject}`,
                      html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                        <p>${replyText.replace(/\n/g, '<br>')}</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #666;">On ${format(new Date(selectedMessage.createdAt), "MMM d, yyyy")}, ${selectedMessage.name} wrote:</p>
                        <blockquote style="border-left: 3px solid #ddd; margin: 0; padding-left: 15px; color: #777;">
                          ${selectedMessage.message.replace(/\n/g, '<br>')}
                        </blockquote>
                      </div>`
                    });
                  }}
                >
                  {replyMutation.isPending ? "Sending..." : "Send Reply"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Marketing tab */}
        <TabsContent value="marketing" className="mt-4 space-y-6">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Newsletter Subscribers
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage your community and export your email list.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search emails..." 
                    className="h-8 w-[200px] pl-9 text-xs"
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs font-mono tracking-tighter"
                  onClick={() => exportSubscribersCSV()}
                >
                  <Download className="h-3 w-3 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="border border-[#E5E5E0] dark:border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-[#E5E5E0] dark:border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Email Address</th>
                    <th className="px-4 py-2 text-left font-semibold">Joined At</th>
                    <th className="px-4 py-2 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
                  {subscribersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><div className="h-3 w-32 bg-muted animate-pulse rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-24 bg-muted animate-pulse rounded" /></td>
                        <td className="px-4 py-3 text-right"><div className="h-3 w-12 bg-muted animate-pulse rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredSubscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic">
                        No subscribers matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscribers.slice(0, 10).map((s) => (
                      <tr key={s.email} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-medium">{s.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.createdAt ? format(new Date(s.createdAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50/50">Active</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                  {filteredSubscribers.length > 10 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-center text-[10px] text-muted-foreground bg-muted/5">
                        Showing first 10 of {filteredSubscribers.length} subscribers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Email Marketing Broadcast
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a newsletter or announcement to {filteredSubscribers.length} subscribers.
                </p>
              </div>
              <Badge variant="outline" className="bg-[#2D4A35]/5 text-[#2D4A35] dark:text-emerald-400 border-[#2D4A35]/20">
                <Mail className="h-3 w-3 mr-1.5" />
                Active Campaign
              </Badge>
            </div>

            <div className="grid gap-6 py-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  Subject Line
                </label>
                <Input 
                  placeholder="e.g. New Seasonal Collection — RARE ATELIER" 
                  value={marketingSubject}
                  onChange={(e) => setMarketingSubject(e.target.value)}
                  className="h-10 px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <Send className="h-3 w-3" />
                  Message Content (HTML Supported)
                </label>
                <div className="relative">
                  <Textarea 
                    placeholder="Compose your email..." 
                    className="min-h-[400px] font-mono text-sm leading-relaxed p-4"
                    value={marketingBody}
                    onChange={(e) => setMarketingBody(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    BCC Broadcast
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E5E0] dark:border-border font-mono text-xs">
              <p className="text-muted-foreground italic mr-auto">
                Careful: This will send an email immediately to all subscribers.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setMarketingSubject("New Seasonal Collection — RARE ATELIER");
                  setMarketingBody(`<div style="font-family: 'serif', 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #07060a; color: #f2efe8; text-align: center;">
  <h1 style="font-size: 32px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #f2efe8;">RARE ATELIER</h1>
  <div style="width: 40px; height: 1px; background: rgba(242, 239, 232, 0.3); margin: 0 auto 32px;"></div>
  <h2 style="font-size: 24px; font-style: italic; margin-bottom: 16px;">The Latest from the Atelier</h2>
  <p style="font-size: 16px; line-height: 1.6; color: rgba(242, 239, 232, 0.7); margin-bottom: 32px; text-align: left;">Dear community,<br><br>[Edit your message here...]</p>
  <div style="margin: 40px 0; padding: 32px; border: 1px solid rgba(242, 239, 232, 0.1);">
     <p style="font-size: 14px; color: #f2efe8; letter-spacing: 0.1em; margin-bottom: 24px;">EXPLORE THE ARCHIVE</p>
     <a href="https://rarenp.com" style="display: inline-block; padding: 14px 28px; background: #f2efe8; color: #07060a; text-decoration: none; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;">Shop Now</a>
  </div>
  <div style="margin-top: 60px; padding-top: 32px; border-top: 1px solid rgba(242, 239, 232, 0.1);">
    <p style="font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242, 239, 232, 0.4);">RARE Nepal · Kathmandu · Heritage Meets Future</p>
  </div>
</div>`);
                }}
              >
                Reset to Template
              </Button>
              <Button 
                className="bg-[#2C3E2D] hover:bg-[#2C3E2D]/90 px-8"
                disabled={broadcastMutation.isPending || !marketingSubject.trim() || !marketingBody.trim()}
                onClick={() => {
                  broadcastMutation.mutate({
                    subject: marketingSubject,
                    html: marketingBody
                  });
                }}
              >
                {broadcastMutation.isPending ? "Dispatching..." : "Send Broadcast"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

