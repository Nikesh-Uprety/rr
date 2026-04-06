import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, Loader2, MoreVertical, Plus, ShieldCheck, Trash2, User as UserIcon } from "lucide-react";
import { useLocation } from "wouter";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUPERADMIN_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "superadmin", label: "Super Admin" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "csr", label: "CSR" },
  { value: "staff", label: "Staff" },
];

const STANDARD_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "manager", label: "Manager" },
  { value: "csr", label: "CSR" },
  { value: "staff", label: "Staff" },
];

const PRIVILEGED_ROLE_VALUES = new Set(["superadmin", "owner", "admin"]);

type StoreUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  profileImageUrl: string | null;
  phoneNumber?: string | null;
  emailNotifications: boolean;
  createdAt: string | Date;
};

function getInitials(nameOrEmail: string) {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "U";

  const parts = trimmed.includes("@")
    ? trimmed.split("@")[0].split(/[\s._-]+/).filter(Boolean)
    : trimmed.split(/\s+/).filter(Boolean);

  const initials = parts.slice(0, 2).map((p) => p[0]).join("");
  return initials.toUpperCase() || "U";
}

function roleBadge(role: string) {
  switch (role) {
    case "superadmin":
      return {
        label: "Super Admin",
        className:
          "bg-rose-100 text-rose-800 border-0 dark:bg-rose-900/30 dark:text-rose-300",
      };
    case "owner":
    case "admin":
      return {
        label: role === "admin" ? "Admin" : "Owner",
        className:
          "bg-amber-100 text-amber-800 border-0 dark:bg-amber-900/30 dark:text-amber-300",
      };
    case "manager":
      return {
        label: "Manager",
        className:
          "bg-blue-100 text-blue-800 border-0 dark:bg-blue-900/30 dark:text-blue-300",
      };
    case "csr":
      return {
        label: "CSR",
        className:
          "bg-emerald-100 text-emerald-800 border-0 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
    case "staff":
    default:
      return {
        label: "Staff",
        className:
          "bg-neutral-100 text-neutral-800 border-0 dark:bg-neutral-800/40 dark:text-neutral-300",
      };
  }
}

export default function StoreUsers() {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useCurrentUser();
  const isCurrentUserSuperAdmin = currentUser?.role?.toLowerCase() === "superadmin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["admin", "store-users"], []);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: StoreUser[];
  }>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/store-users");
      return (await res.json()) as { success: boolean; data: StoreUser[] };
    },
  });

  const storeUsers = data?.data ?? [];

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
  });

  const [editingRoleUser, setEditingRoleUser] = useState<StoreUser | null>(null);
  const [editingRole, setEditingRole] = useState("manager");

  const [deletingUser, setDeletingUser] = useState<StoreUser | null>(null);
  const [navigatingUserId, setNavigatingUserId] = useState<string | null>(null);
  const [pendingPatchUserId, setPendingPatchUserId] = useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const roleOptions = useMemo(
    () => (isCurrentUserSuperAdmin ? SUPERADMIN_ROLE_OPTIONS : STANDARD_ROLE_OPTIONS),
    [isCurrentUserSuperAdmin],
  );
  const normalizeEditableRole = (role: string) => {
    const lowered = role.toLowerCase();
    return roleOptions.some((option) => option.value === lowered) ? lowered : roleOptions[0]?.value ?? "manager";
  };

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      email: string;
      password: string;
      role: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/store-users", payload);
      return (await res.json()) as { success: boolean; data: StoreUser };
    },
    onSuccess: async (result) => {
      if (!result.success) {
        toast({ title: "Failed to add user", variant: "destructive" });
        return;
      }
      toast({ title: "User added", description: "Setup email sent (SMTP may be delayed)." });
      setIsAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: roleOptions[0]?.value ?? "manager" });
      invalidate();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add user",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Partial<{ role: string; email_notifications: boolean }> }) => {
      const res = await apiRequest("PATCH", `/api/admin/store-users/${payload.id}`, payload.data);
      return (await res.json()) as { success: boolean; data: StoreUser };
    },
    onMutate: async (payload) => {
      setPendingPatchUserId(payload.id);
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      invalidate();
    },
    onSettled: () => {
      setPendingPatchUserId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/store-users/${id}`);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onMutate: async (id) => {
      setPendingDeleteUserId(id);
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Delete failed", variant: "destructive" });
        return;
      }
      toast({ title: "User removed" });
      setDeletingUser(null);
      invalidate();
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPendingDeleteUserId(null);
    },
  });

  const isSelf = (u: StoreUser) => currentUser?.id && u.id === currentUser.id;
  const openUserProfile = (userId: string) => {
    setNavigatingUserId(userId);
    setLocation(`/admin/store-users/${userId}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Store Users
          </h1>
          <p className="text-muted-foreground mt-1">Manage internal team members</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            className="flex-1 sm:flex-none bg-[#2C3E2D] hover:bg-[#1A251B] text-white"
            onClick={() => setIsAddOpen(true)}
            disabled={isLoading || createMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" /> Add User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-center gap-3 opacity-70">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading users...</span>
          </div>
        </div>
      ) : storeUsers.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="mt-4 font-semibold">No team members yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first user.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-transparent">
                  <TableRow>
                    <TableHead className="w-[260px] py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Team Member
                    </TableHead>
                    <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Role
                    </TableHead>
                    <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email Notifications
                    </TableHead>
                    <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Added At
                    </TableHead>
                    <TableHead className="text-right py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#E5E5E0] dark:divide-border">
                  {storeUsers.map((u) => {
                    const initials = getInitials(u.name || u.email);
                    const rb = roleBadge(u.role);
                    const addedAt = u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "";
                    const targetRole = u.role?.toLowerCase() ?? "";
                    const canManagePrivilegedTarget = isCurrentUserSuperAdmin || !PRIVILEGED_ROLE_VALUES.has(targetRole);
                    const canDeleteTarget = !isSelf(u) && canManagePrivilegedTarget;

                    return (
                      <TableRow
                        key={u.id}
                        className="group cursor-pointer border-b border-[#E5E5E0] transition-all duration-200 hover:bg-[#F7F5EF] dark:border-border dark:hover:bg-muted/40"
                        onClick={() => openUserProfile(u.id)}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-11 h-11 shadow-sm border border-black/5 dark:border-white/5">
                              {u.profileImageUrl ? (
                                <img src={u.profileImageUrl} alt={u.name ?? u.email} className="object-cover" />
                              ) : (
                                <AvatarFallback className="text-white text-sm font-bold bg-transparent bg-muted text-center">
                                  {initials}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-[#2C3E2D] dark:text-foreground truncate">
                                  {u.name ?? "—"}
                                </div>
                                {navigatingUserId === u.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="text-sm font-medium text-muted-foreground">{u.email}</div>
                        </TableCell>

                        <TableCell className="py-4">
                          <Badge className={`h-6 px-2 flex items-center ${rb.className}`}>{rb.label}</Badge>
                        </TableCell>

                        <TableCell className="py-4">
                          <div
                            className="flex items-center gap-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Switch
                              checked={u.emailNotifications}
                              disabled={!canManagePrivilegedTarget || pendingPatchUserId === u.id}
                              onCheckedChange={(checked) => {
                                patchMutation.mutate({
                                  id: u.id,
                                  data: { email_notifications: checked },
                                });
                              }}
                            />
                            {pendingPatchUserId === u.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : null}
                            <span className="text-xs text-muted-foreground w-10">
                              {u.emailNotifications ? "On" : "Off"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <span className="text-sm text-muted-foreground">{addedAt}</span>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-muted rounded-full"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 rounded-xl overflow-hidden border-border shadow-lg">
                                <DropdownMenuItem
                                  disabled={!canManagePrivilegedTarget}
                                  className="cursor-pointer flex items-center gap-2 py-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setEditingRoleUser(u);
                                    setEditingRole(normalizeEditableRole(u.role));
                                  }}
                                >
                                  <ShieldCheck className="w-4 h-4 text-primary" />
                                  Edit Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer flex items-center gap-2 py-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openUserProfile(u.id);
                                  }}
                                >
                                  <ShieldCheck className="w-4 h-4 text-primary" />
                                  Manage Access
                                </DropdownMenuItem>

                                {canDeleteTarget && (
                                  <DropdownMenuItem
                                    className="cursor-pointer flex items-center gap-2 py-2 text-destructive focus:text-destructive"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeletingUser(u);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete User
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {storeUsers.map((u) => {
              const rb = roleBadge(u.role);
              const initials = getInitials(u.name || u.email);
              const addedAt = u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "";
              const targetRole = u.role?.toLowerCase() ?? "";
              const canManagePrivilegedTarget = isCurrentUserSuperAdmin || !PRIVILEGED_ROLE_VALUES.has(targetRole);
              const canDeleteTarget = !isSelf(u) && canManagePrivilegedTarget;
              return (
                <div
                  key={u.id}
                  className="group cursor-pointer rounded-xl border border-border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F7F5EF] dark:bg-card dark:hover:bg-muted/40"
                  onClick={() => openUserProfile(u.id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12 shadow-sm border border-black/5 dark:border-white/5 shrink-0">
                      {u.profileImageUrl ? (
                        <img src={u.profileImageUrl} alt={u.name ?? u.email} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-white text-sm font-bold bg-transparent bg-muted text-center">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-[#2C3E2D] dark:text-foreground truncate">
                              {u.name ?? "—"}
                            </div>
                            {navigatingUserId === u.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-muted rounded-full"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl overflow-hidden border-border shadow-lg">
                            <DropdownMenuItem
                              disabled={!canManagePrivilegedTarget}
                              className="cursor-pointer flex items-center gap-2 py-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingRoleUser(u);
                                setEditingRole(normalizeEditableRole(u.role));
                              }}
                            >
                              <ShieldCheck className="w-4 h-4 text-primary" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer flex items-center gap-2 py-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                openUserProfile(u.id);
                              }}
                            >
                              <ShieldCheck className="w-4 h-4 text-primary" />
                              Manage Access
                            </DropdownMenuItem>
                            {canDeleteTarget && (
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 py-2 text-destructive focus:text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeletingUser(u);
                                }}
                              >
                                <Trash2 className="w-4 h-4" /> Delete User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Badge className={`h-6 px-2 flex items-center ${rb.className}`}>{rb.label}</Badge>
                        <div
                          className="flex items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Switch
                            checked={u.emailNotifications}
                            disabled={!canManagePrivilegedTarget || pendingPatchUserId === u.id}
                            onCheckedChange={(checked) => {
                              patchMutation.mutate({
                                id: u.id,
                                data: { email_notifications: checked },
                              });
                            }}
                          />
                          {pendingPatchUserId === u.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Added {addedAt}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add user dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setAddForm({ name: "", email: "", password: "", role: roleOptions[0]?.value ?? "manager" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add Team Member</DialogTitle>
            <DialogDescription>Creates a new internal user and sends a welcome email.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!addForm.name.trim()) {
                toast({ title: "Name is required", variant: "destructive" });
                return;
              }
              if (!addForm.email.trim()) {
                toast({ title: "Email is required", variant: "destructive" });
                return;
              }
              if (!addForm.password.trim()) {
                toast({ title: "Password is required", variant: "destructive" });
                return;
              }

              createMutation.mutate({
                name: addForm.name.trim(),
                email: addForm.email.trim(),
                password: addForm.password,
                role: addForm.role,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="store-user-name">Name</Label>
              <Input
                id="store-user-name"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Ramesh Karki"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-user-email">Email</Label>
              <Input
                id="store-user-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="team@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-user-password">Password</Label>
              <Input
                id="store-user-password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(value) => setAddForm((p) => ({ ...p, role: value }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="rounded-full"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white"
                loading={createMutation.isPending}
                loadingText="Creating..."
              >
                Add User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog
        open={!!editingRoleUser}
        onOpenChange={(open) => {
          if (!open) setEditingRoleUser(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Role</DialogTitle>
            <DialogDescription>
              Update the role for{" "}
              <strong>{editingRoleUser?.name ?? editingRoleUser?.email ?? "user"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingRoleUser) return;
              patchMutation.mutate({
                id: editingRoleUser.id,
                data: { role: editingRole },
              });
              setEditingRoleUser(null);
            }}
          >
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editingRole} onValueChange={setEditingRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRoleUser(null)}
                className="rounded-full"
                disabled={patchMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white"
                loading={patchMutation.isPending}
                loadingText="Saving..."
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-destructive">Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deletingUser?.name ?? deletingUser?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending || pendingDeleteUserId === deletingUser?.id ? "Deleting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
