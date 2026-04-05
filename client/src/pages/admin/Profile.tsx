import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadProgress } from "@/components/ui/upload-progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  ADMIN_FONT_OPTIONS,
  DEFAULT_ADMIN_FONT_SETTINGS,
  type AdminFontMode,
  type AdminFontScale,
  persistAdminFontSettings,
  readAdminFontSettings,
} from "@/lib/adminFont";
import { canAccessAdminPage } from "@shared/auth-policy";
import {
  Camera,
  Trash2,
  AlertTriangle,
  ImagePlus,
  PencilLine,
  Expand,
  Clock3,
  Check,
  Type,
  Plus,
  Pencil,
} from "lucide-react";
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

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  phoneNumber?: string | null;
  role: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  status: string;
  profileImageUrl?: string | null;
}

interface AvatarHistoryItem {
  filename: string;
  url: string;
  uploadedAt: string;
  size: number;
}

const ROOT_SUPERADMIN_EMAIL = "superadmin@rare.np";
const PROFILE_USER_ROLE_OPTIONS = [
  { value: "superadmin", label: "Super Admin" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "csr", label: "CSR" },
  { value: "staff", label: "Staff" },
];

export default function AdminProfilePage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("account");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [adminFontMode, setAdminFontMode] = useState<AdminFontMode>(() => readAdminFontSettings().mode);
  const [adminFontScale, setAdminFontScale] = useState<AdminFontScale>(() => readAdminFontSettings().scale);

  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImageUrl || null);
  const [avatarUploadProvider, setAvatarUploadProvider] = useState<"local" | "cloudinary">("cloudinary");
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [showAvatarUploadProgress, setShowAvatarUploadProgress] = useState(false);
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [isEmailVerifyOpen, setIsEmailVerifyOpen] = useState(false);
  const [emailTempToken, setEmailTempToken] = useState("");
  const [emailVerifyCode, setEmailVerifyCode] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState<string | null>(null);

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    profileImageUrl: "",
    role: "staff",
    password: "",
  });
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(user?.profileImageUrl || null);
  const [avatarToDelete, setAvatarToDelete] = useState<AvatarHistoryItem | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const canManageAdminUsers = canAccessAdminPage(user?.role, "store-users");
  const isRootSuperAdmin =
    user?.role?.toLowerCase() === "superadmin" &&
    user?.email?.toLowerCase() === ROOT_SUPERADMIN_EMAIL;

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
    enabled: activeTab === "users" && canManageAdminUsers,
  });

  const { data: avatarHistory = [], isLoading: avatarHistoryLoading } = useQuery<AvatarHistoryItem[]>({
    queryKey: ["admin", "profile", "avatar-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/profile/avatar-history");
      const json = (await res.json()) as { success: boolean; data?: AvatarHistoryItem[] };
      return json.data ?? [];
    },
    enabled: activeTab === "account" && !!user,
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          title: "Could not delete user",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "User deleted",
        description: "The user has been permanently removed.",
      });
      setIsDeleteDialogOpen(false);
      setDeleteUserId(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Could not delete user",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const resetUserForm = () => {
    setUserForm({
      name: "",
      email: "",
      phoneNumber: "",
      profileImageUrl: "",
      role: isRootSuperAdmin ? "admin" : "staff",
      password: "",
    });
    setEditingAdminUser(null);
  };

  const createAdminUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/store-users", {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        role: userForm.role,
        phoneNumber: userForm.phoneNumber.trim() || undefined,
        profileImageUrl: userForm.profileImageUrl.trim() || undefined,
      });
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Could not add user", description: result.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "User added" });
      setIsUserFormOpen(false);
      resetUserForm();
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add user", description: err.message, variant: "destructive" });
    },
  });

  const updateAdminUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingAdminUser) throw new Error("No user selected");
      const res = await apiRequest("PATCH", `/api/admin/store-users/${editingAdminUser.id}`, {
        name: userForm.name.trim(),
        role: userForm.role,
        phone_number: userForm.phoneNumber.trim() || undefined,
        profile_image_url: userForm.profileImageUrl.trim() || undefined,
      });
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Could not update user", description: result.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "User updated" });
      setIsUserFormOpen(false);
      resetUserForm();
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update user", description: err.message, variant: "destructive" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; profileImageUrl?: string }) => {
      const res = await apiRequest("PUT", "/api/admin/profile/update", data);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Profile not updated", description: result.error, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Profile not updated", description: err.message, variant: "destructive" });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (payload: {
      imageBase64: string;
      provider: "local" | "cloudinary";
      onProgress?: (value: number) => void;
    }) => {
      const json = await new Promise<{
        success: boolean;
        url?: string;
        provider?: "local" | "cloudinary";
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/profile/upload-avatar", true);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", "application/json");

        if (xhr.upload && payload.onProgress) {
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            payload.onProgress?.(percent);
          };
        }

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok) {
            reject(new Error(xhr.responseText || "Upload failed"));
            return;
          }
          try {
            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : { success: false });
          } catch {
            resolve({ success: false, error: "Upload failed" });
          }
        };

        xhr.send(JSON.stringify({ imageBase64: payload.imageBase64, provider: payload.provider }));
      });

      return json;
    },
    onSuccess: (result) => {
      if (!result.success || !result.url) {
        toast({ title: "Upload failed", description: result.error, variant: "destructive" });
        return;
      }
      setProfileImage(result.url);
      setSelectedAvatarUrl(result.url);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "avatar-history"] });
      toast({
        title: "Profile picture updated",
        description:
          result.provider === "cloudinary"
            ? "Uploaded via Cloudinary."
            : "Uploaded to local storage.",
      });
      setAvatarUploadProgress(100);
      setTimeout(() => setShowAvatarUploadProgress(false), 700);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setShowAvatarUploadProgress(false);
      setAvatarUploadProgress(0);
    },
  });

  const handleAvatarSelect = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    setShowAvatarUploadProgress(true);
    setAvatarUploadProgress(0);
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 25);
      setAvatarUploadProgress(percent);
    };
    reader.onload = () => {
      const base64 = reader.result as string;
      avatarMutation.mutate({
        imageBase64: base64,
        provider: avatarUploadProvider,
        onProgress: (value) => {
          const scaled = 25 + Math.round(value * 0.75);
          setAvatarUploadProgress(scaled);
        },
      });
    };
    reader.onerror = () => {
      toast({ title: "Upload failed", description: "Unable to read the file.", variant: "destructive" });
      setShowAvatarUploadProgress(false);
      setAvatarUploadProgress(0);
    };
    reader.readAsDataURL(file);
  };

  const applyDevFontSettings = (next: { mode?: AdminFontMode; scale?: AdminFontScale }) => {
    const settings = {
      mode: next.mode ?? adminFontMode,
      scale: next.scale ?? adminFontScale,
    };
    setAdminFontMode(settings.mode);
    setAdminFontScale(settings.scale);
    persistAdminFontSettings(settings);
    const selectedFont = ADMIN_FONT_OPTIONS.find((option) => option.mode === settings.mode);
    toast({
      title: "Admin font updated",
      description: `${selectedFont?.label ?? settings.mode} • ${settings.scale === "large" ? "Large" : "Comfortable"} size`,
    });
  };

  const applyAvatarMutation = useMutation({
    mutationFn: async (profileImageUrl: string) => {
      const res = await apiRequest("PUT", "/api/admin/profile/update", { profileImageUrl });
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result, profileImageUrl) => {
      if (!result.success) {
        toast({ title: "Profile not updated", description: result.error, variant: "destructive" });
        return;
      }
      setProfileImage(profileImageUrl);
      setSelectedAvatarUrl(profileImageUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "avatar-history"] });
      toast({ title: "Profile picture applied" });
    },
    onError: (err: Error) => {
      toast({ title: "Profile not updated", description: err.message, variant: "destructive" });
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      const res = await apiRequest("DELETE", "/api/admin/profile/avatar", { url: avatarUrl });
      return (await res.json()) as { success: boolean; error?: string; removedCurrentImage?: boolean };
    },
    onSuccess: (result, avatarUrl) => {
      if (!result.success) {
        toast({ title: "Image not removed", description: result.error, variant: "destructive" });
        return;
      }

      if (selectedAvatarUrl === avatarUrl) {
        setSelectedAvatarUrl(result.removedCurrentImage ? null : profileImage);
      }

      if (result.removedCurrentImage) {
        setProfileImage(null);
        setSelectedAvatarUrl(null);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }

      setAvatarToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "profile", "avatar-history"] });
      toast({
        title: "Image removed",
        description: result.removedCurrentImage
          ? "The current profile image was removed."
          : "The uploaded image was deleted.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Image not removed", description: err.message, variant: "destructive" });
    },
  });

  const emailChangeMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const res = await apiRequest("POST", "/api/admin/profile/update-email", { newEmail });
      return (await res.json()) as { success: boolean; tempToken?: string; code?: string; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Email change failed", description: result.error, variant: "destructive" });
        return;
      }
      setEmailTempToken(result.tempToken || "");
      setEmailOtpCode(result.code || null);
      setIsEmailVerifyOpen(true);
      toast({ title: "Verification code sent", description: "Check your new email for the code." });
    },
    onError: (err: Error) => {
      toast({ title: "Email change failed", description: err.message, variant: "destructive" });
    },
  });

  const emailVerifyMutation = useMutation({
    mutationFn: async (data: { tempToken: string; code: string; newEmail: string }) => {
      const res = await apiRequest("POST", "/api/admin/profile/verify-email", data);
      return (await res.json()) as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({ title: "Verification failed", description: result.error, variant: "destructive" });
        return;
      }
      setIsEmailVerifyOpen(false);
      setEmailVerifyCode("");
      setEmailOtpCode(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Email updated", description: "Your email has been changed successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and admin settings.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={cn("grid w-full", canManageAdminUsers ? "grid-cols-2" : "grid-cols-1")}>
          <TabsTrigger value="account">Account</TabsTrigger>
          {canManageAdminUsers && <TabsTrigger value="users">All Admin Users</TabsTrigger>}
        </TabsList>

        <TabsContent value="account" className="mt-4 space-y-6">
          {/* Basic Profile */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 flex flex-col lg:flex-row gap-8 items-stretch">
            <div className="w-full sm:w-[260px] shrink-0">
              <div className="rounded-[28px] border border-[#E5E5E0] dark:border-border bg-gradient-to-br from-[#F6F3EC] via-white to-[#EEF5F0] dark:from-[#1B241C] dark:via-[#161C17] dark:to-[#202A22] p-4 shadow-sm">
                <div
                  className="group relative aspect-[4/5] overflow-hidden rounded-[22px] border border-black/5 dark:border-white/10 bg-[#D9E4DA] dark:bg-[#263328] cursor-pointer"
                  onClick={() => {
                    setSelectedAvatarUrl(profileImage);
                    setIsAvatarPreviewOpen(true);
                  }}
                >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-contain bg-white/80 dark:bg-black/10"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[#2D4A35] dark:text-[#DCE7DD]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2D4A35] text-2xl font-semibold text-white shadow-lg">
                      {(user?.name || user?.email || "U")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Add profile photo
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 py-4 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <div className="rounded-full bg-white/15 p-2 text-white backdrop-blur">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                    Change photo
                  </div>
                </div>
              </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
                    {(["cloudinary", "local"] as const).map((providerOption) => (
                      <button
                        key={providerOption}
                        type="button"
                        onClick={() => setAvatarUploadProvider(providerOption)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                          avatarUploadProvider === providerOption
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {providerOption === "cloudinary" ? "Cloudinary" : "Local"}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2 rounded-full"
                    loading={avatarMutation.isPending}
                    loadingText="Uploading..."
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {profileImage ? "Replace Image" : "Upload Image"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-full"
                    onClick={() => {
                      setSelectedAvatarUrl(profileImage);
                      setIsAvatarPreviewOpen(true);
                    }}
                  >
                    <Expand className="h-4 w-4" />
                    View Photo
                  </Button>
                </div>
                {showAvatarUploadProgress && (
                  <div className="mt-3">
                    <UploadProgress value={avatarUploadProgress} label="Upload progress" className="max-w-none" />
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Upload target: {avatarUploadProvider === "cloudinary" ? "Cloudinary CDN" : "Local server storage"}.
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Portrait images now keep their original orientation and display without forced horizontal cropping.
                </p>
              </div>
              <input
                id="avatar-upload"
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleAvatarSelect(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <Badge variant="outline" className="text-[11px]">
                {user?.role?.toUpperCase() || "STAFF"}
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
                <div className="flex gap-2">
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-10 flex-1"
                  />
                  {editEmail !== (user?.email ?? "") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-xs"
                      loading={emailChangeMutation.isPending}
                      loadingText="Sending..."
                      onClick={() => emailChangeMutation.mutate(editEmail)}
                    >
                      Verify & Update
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  loading={profileMutation.isPending}
                  loadingText="Saving..."
                  disabled={displayName === (user?.name ?? "")}
                  className="h-10"
                  onClick={() => profileMutation.mutate({ displayName })}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>

          {/* Security & Password */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Account Security
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
                  Confirm Password
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
                className="h-10"
                loading={passwordMutation.isPending}
                loadingText="Updating..."
                disabled={!passwordNew}
                onClick={() => passwordMutation.mutate()}
              >
                Update Password
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  <Type className="h-4 w-4" />
                  Dev Font Switch
                </h2>
                <p className="text-xs text-muted-foreground">
                  Dev-only font controls for verifying admin readability across the panel and login page.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                Dev Only
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Font Family
                </label>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {ADMIN_FONT_OPTIONS.map((option) => (
                    <Button
                      key={option.mode}
                      type="button"
                      variant={adminFontMode === option.mode ? "default" : "outline"}
                      className="h-auto min-h-11 justify-start px-4 py-3 text-left"
                      onClick={() => applyDevFontSettings({ mode: option.mode })}
                    >
                      <span className="block">
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 block text-[11px] opacity-80">{option.description}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Font Size
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={adminFontScale === "comfortable" ? "default" : "outline"}
                    className="h-10"
                    onClick={() => applyDevFontSettings({ scale: "comfortable" })}
                  >
                    Comfortable
                  </Button>
                  <Button
                    type="button"
                    variant={adminFontScale === "large" ? "default" : "outline"}
                    className="h-10"
                    onClick={() => applyDevFontSettings({ scale: "large" })}
                  >
                    Large
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10"
                    onClick={() => {
                      setAdminFontMode(DEFAULT_ADMIN_FONT_SETTINGS.mode);
                      setAdminFontScale(DEFAULT_ADMIN_FONT_SETTINGS.scale);
                      persistAdminFontSettings(DEFAULT_ADMIN_FONT_SETTINGS);
                      toast({
                        title: "Admin font reset",
                        description: "Default admin font settings restored.",
                      });
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 2FA Section */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Two-Factor Authentication
                </h2>
                <p className="text-xs text-muted-foreground">
                  Secure your account by requiring an email verification code at login.
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

        {/* Admin Management */}
        {canManageAdminUsers && (
          <TabsContent value="users" className="mt-4">
            <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                    All Admin Users
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Manage account details, roles, and access from one place.
                  </p>
                </div>
                {isRootSuperAdmin && (
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      resetUserForm();
                      setIsUserFormOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[#E5E5E0] dark:border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 text-left font-semibold">User</th>
                      <th className="py-2 pr-4 text-left font-semibold">Phone</th>
                      <th className="py-2 pr-4 text-left font-semibold">Role</th>
                      <th className="py-2 pr-4 text-left font-semibold">2FA</th>
                      <th className="py-2 pr-4 text-left font-semibold">Last Login</th>
                      <th className="py-2 pl-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="py-8 text-center animate-pulse text-muted-foreground">
                            Loading team data...
                          </td>
                        </tr>
                      ))
                    ) : (
                      adminUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[#F0F0EB] dark:border-border/50">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-muted/20">
                                {u.profileImageUrl ? (
                                  <img
                                    src={u.profileImageUrl}
                                    alt={u.name || u.email}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    {(u.name || u.email).slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{u.name || u.email}</div>
                                <div className="text-[10px] text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {u.phoneNumber || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className="text-[10px]">
                              {u.role.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Switch
                              checked={u.twoFactorEnabled}
                              disabled={!isRootSuperAdmin || u.id === user?.id}
                              onCheckedChange={(enabled) => {
                                twoFAMutation.mutate({ id: u.id, enabled });
                              }}
                            />
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-3 pl-2 text-right">
                            {isRootSuperAdmin && (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingAdminUser(u);
                                    setUserForm({
                                      name: u.name || "",
                                      email: u.email,
                                      phoneNumber: u.phoneNumber || "",
                                      profileImageUrl: u.profileImageUrl || "",
                                      role: u.role,
                                      password: "",
                                    });
                                    setIsUserFormOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {u.id !== user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      setDeleteUserId(u.id);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

      </Tabs>

      <Dialog
        open={isUserFormOpen}
        onOpenChange={(open) => {
          setIsUserFormOpen(open);
          if (!open) resetUserForm();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingAdminUser ? "Edit Admin User" : "Add Admin User"}</DialogTitle>
            <DialogDescription>
              {editingAdminUser
                ? "Update full profile and role details."
                : "Create a user with full name, email, phone, image, and role."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isRootSuperAdmin) {
                toast({ title: "Only superadmin@rare.np can manage admin users", variant: "destructive" });
                return;
              }
              if (!userForm.name.trim() || !userForm.email.trim()) {
                toast({ title: "Full name and email are required", variant: "destructive" });
                return;
              }
              if (!editingAdminUser && userForm.password.trim().length < 6) {
                toast({ title: "Password must be at least 6 characters", variant: "destructive" });
                return;
              }
              if (editingAdminUser) {
                updateAdminUserMutation.mutate();
              } else {
                createAdminUserMutation.mutate();
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Full Name</Label>
                <Input
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  disabled={!!editingAdminUser}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="user@rare.np"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={userForm.phoneNumber}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+97798xxxxxxxx"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Profile Image URL</Label>
                <Input
                  value={userForm.profileImageUrl}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, profileImageUrl: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={userForm.role} onValueChange={(value) => setUserForm((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_USER_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!editingAdminUser && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsUserFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createAdminUserMutation.isPending || updateAdminUserMutation.isPending}
                loadingText={editingAdminUser ? "Saving..." : "Creating..."}
              >
                {editingAdminUser ? "Save Changes" : "Add User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <Dialog open={isEmailVerifyOpen} onOpenChange={setIsEmailVerifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify Email Change</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to <strong>{editEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {emailOtpCode && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                <p className="text-[10px] uppercase tracking-wider text-amber-600 mb-1">Dev Code</p>
                <p className="text-2xl font-bold tracking-[8px] text-amber-700">{emailOtpCode}</p>
              </div>
            )}
            <Input
              placeholder="000000"
              value={emailVerifyCode}
              onChange={(e) => setEmailVerifyCode(e.target.value)}
              className="text-center text-lg tracking-[8px] h-12"
              maxLength={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailVerifyOpen(false)}>Cancel</Button>
            <Button
              loading={emailVerifyMutation.isPending}
              loadingText="Verifying..."
              disabled={emailVerifyCode.length < 6}
              onClick={() => {
                emailVerifyMutation.mutate({
                  tempToken: emailTempToken,
                  code: emailVerifyCode,
                  newEmail: editEmail,
                });
              }}
            >
              Verify & Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAvatarPreviewOpen} onOpenChange={setIsAvatarPreviewOpen}>
        <DialogContent className="max-w-5xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
          <div className="grid overflow-hidden rounded-[28px] border border-white/10 bg-[#0F140F]/95 backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative flex min-h-[420px] items-center justify-center bg-[radial-gradient(circle_at_top,#24412d,transparent_45%),linear-gradient(180deg,#121a13,#0b0f0c)] p-6 sm:p-8">
              {selectedAvatarUrl ? (
                <img
                  src={selectedAvatarUrl}
                  alt="Profile preview"
                  className="max-h-[75vh] w-auto max-w-full rounded-[22px] border border-white/10 bg-black/10 object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                />
              ) : (
                <div className="flex h-[320px] w-full max-w-[360px] items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-white/5 text-sm text-white/70">
                  No profile image selected
                </div>
              )}
            </div>
            <div className="border-t border-white/10 bg-black/25 p-5 text-white lg:border-l lg:border-t-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Camera className="h-4 w-4" />
                  Profile Image
                </DialogTitle>
                <DialogDescription className="text-sm text-white/65">
                  Preview the current photo, choose a recent upload, or replace it with a new one.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/10 p-1">
                  {(["cloudinary", "local"] as const).map((providerOption) => (
                    <button
                      key={`dialog-${providerOption}`}
                      type="button"
                      onClick={() => setAvatarUploadProvider(providerOption)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                        avatarUploadProvider === providerOption
                          ? "bg-white text-black shadow-sm"
                          : "text-white/70 hover:text-white",
                      )}
                    >
                      {providerOption === "cloudinary" ? "Cloudinary" : "Local"}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 rounded-full bg-white text-black hover:bg-white/90"
                  loading={avatarMutation.isPending}
                  loadingText="Uploading..."
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload New
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  disabled={!selectedAvatarUrl || selectedAvatarUrl === profileImage || applyAvatarMutation.isPending}
                  loading={applyAvatarMutation.isPending}
                  loadingText="Applying..."
                  onClick={() => {
                    if (selectedAvatarUrl) applyAvatarMutation.mutate(selectedAvatarUrl);
                  }}
                >
                  <PencilLine className="h-4 w-4" />
                  Use This Image
                </Button>
                {selectedAvatarUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-full border-red-400/20 bg-transparent text-red-200 hover:bg-red-500/10 hover:text-red-100"
                    onClick={() => {
                      const selectedItem = avatarHistory.find((item) => item.url === selectedAvatarUrl);
                      if (selectedItem) setAvatarToDelete(selectedItem);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Image
                  </Button>
                )}
              </div>
              {showAvatarUploadProgress && (
                <div className="mt-3">
                  <UploadProgress value={avatarUploadProgress} label="Upload progress" className="max-w-none" />
                </div>
              )}
              <p className="mt-2 text-xs text-white/60">
                Upload target: {avatarUploadProvider === "cloudinary" ? "Cloudinary CDN" : "Local server storage"}.
              </p>

              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  <Clock3 className="h-4 w-4" />
                  Recent Uploads
                </div>
                <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                  {avatarHistoryLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                      Loading recent uploads...
                    </div>
                  ) : avatarHistory.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                      Your recent profile uploads will appear here.
                    </div>
                  ) : (
                    avatarHistory.map((item) => {
                      const isActive = selectedAvatarUrl === item.url;
                      const isCurrent = profileImage === item.url;
                      return (
                        <button
                          key={item.filename}
                          type="button"
                          className={cn(
                            "flex items-center gap-3 rounded-2xl border p-2 text-left transition-all",
                            isActive
                              ? "border-emerald-400/70 bg-emerald-400/10"
                              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                          )}
                          onClick={() => setSelectedAvatarUrl(item.url)}
                        >
                          <div className="relative h-16 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                            <img src={item.url} alt="Recent upload" className="h-full w-full object-cover" />
                            {isCurrent && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {new Date(item.uploadedAt).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                              {(item.size / 1024 / 1024).toFixed(2)} MB
                              {isCurrent ? " • Current image" : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 rounded-full p-0 text-red-200 hover:bg-red-500/15 hover:text-red-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAvatarToDelete(item);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!avatarToDelete} onOpenChange={(open) => !open && setAvatarToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Image
            </DialogTitle>
            <DialogDescription>
              This removes the uploaded image from your admin avatar history.
            </DialogDescription>
          </DialogHeader>
          {avatarToDelete && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="h-16 w-14 overflow-hidden rounded-xl border border-border bg-background">
                  <img src={avatarToDelete.url} alt="Avatar to delete" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {new Date(avatarToDelete.uploadedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(avatarToDelete.size / 1024 / 1024).toFixed(2)} MB
                    {profileImage === avatarToDelete.url ? " • Current image" : ""}
                  </p>
                </div>
              </div>
              {profileImage === avatarToDelete.url && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  This is your current profile image. Deleting it will clear the profile photo until you choose another image.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvatarToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteAvatarMutation.isPending}
              loadingText="Deleting..."
              onClick={() => {
                if (avatarToDelete) deleteAvatarMutation.mutate(avatarToDelete.url);
              }}
            >
              Delete Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Permanent removal of admin access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              loadingText="Deleting..."
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
