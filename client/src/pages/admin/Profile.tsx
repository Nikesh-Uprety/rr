import { useState, lazy, Suspense } from "react";
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
import { AdvancedEmailEditor } from "@/components/admin/AdvancedEmailEditor";

const SecuritySection = lazy(() => import("@/components/admin/SecuritySection"));

import {
  type AdminCustomer,
  type AdminOrder,
  exportSubscribersCSV,
  addNewsletterEmail,
  importNewsletterEmails,
  deleteNewsletterEmail,
  deleteAllNewsletterEmails,
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
  FileSpreadsheet,
  Camera,
  Trash2,
  PlusCircle,
  AlertTriangle,
  Upload,
  FileCode,
  Copy,
  Eye,
  X,
  Maximize2,
  Minimize2,
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
  profileImageUrl?: string | null;
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
    mutationFn: async (imageBase64: string) => {
      const res = await apiRequest("POST", "/api/admin/profile/upload-avatar", { imageBase64 });
      return (await res.json()) as { success: boolean; url?: string; error?: string };
    },
    onSuccess: (result) => {
      if (!result.success || !result.url) {
        toast({ title: "Upload failed", description: result.error, variant: "destructive" });
        return;
      }
      setProfileImage(result.url);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile picture updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
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

  // Profile image upload state
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImageUrl || null);

  // Email change state
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [isEmailVerifyOpen, setIsEmailVerifyOpen] = useState(false);
  const [emailTempToken, setEmailTempToken] = useState("");
  const [emailVerifyCode, setEmailVerifyCode] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState<string | null>(null);

  // Delete user state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
  const [newSubscriberEmail, setNewSubscriberEmail] = useState("");
  const [showSplitEditor, setShowSplitEditor] = useState(true);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("template6");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBroadcastConfirmOpen, setIsBroadcastConfirmOpen] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");

  // Email Templates
  const emailTemplates = {
    template4: {
      name: "Colorful Creative",
      subject: "🎨 Creative Update from RARE",
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #ffecd2 0%, #fcb69f 100%);">
  <div style="padding: 50px 30px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
    <h1 style="font-size: 32px; color: #2c2c2c; margin: 0 0 12px 0; font-weight: 700;">Something Special</h1>
    <p style="font-size: 16px; color: #555; margin: 0; line-height: 1.6;">We've curated something amazing for you</p>
  </div>
  <div style="background: white; margin: 20px; border-radius: 8px; padding: 30px; text-align: center;">
    <h3 style="font-size: 18px; color: #2c2c2c; margin: 0 0 12px 0;">Explore Now</h3>
    <p style="font-size: 14px; color: #666; margin: 0 0 20px 0;">[Add description here]</p>
    <a href="https://rarenp.com" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 13px;">Discover</a>
  </div>
  <div style="padding: 20px; text-align: center; font-size: 11px; color: rgba(44,44,44,0.6);">
    <p style="margin: 0;">© RARE Nepal 2026</p>
  </div>
</div>`,
    },
    template5: {
      name: "Dark Luxe",
      subject: "Exclusive Access: Limited Edition Drop",
      html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #f0f0f0;">
  <div style="padding: 50px 30px; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); text-align: center; border-bottom: 3px solid #d4af37;">
    <div style="font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: #d4af37; margin-bottom: 16px;">Limited Edition</div>
    <h1 style="font-size: 36px; color: #f0f0f0; margin: 0; font-weight: 300;">RARE Exclusive</h1>
  </div>
  <div style="padding: 40px 30px; text-align: center;">
    <p style="font-size: 16px; color: #d4af37; margin: 0 0 12px 0; letter-spacing: 1px;">NOW AVAILABLE</p>
    <h2 style="font-size: 24px; color: #f0f0f0; margin: 0 0 20px 0; line-height: 1.4;">Members Get Early Access</h2>
    <p style="font-size: 14px; color: #b0b0b0; margin: 0 0 24px 0; line-height: 1.6;">Join our exclusive collection today</p>
    <a href="https://rarenp.com" style="display: inline-block; padding: 14px 40px; border: 2px solid #d4af37; color: #d4af37; text-decoration: none; font-weight: 600; letter-spacing: 1px; font-size: 12px;">UNLOCK ACCESS</a>
  </div>
  <div style="background: #0a0a0a; padding: 24px; text-align: center; border-top: 1px solid #333; font-size: 11px; color: #666;">
    <p style="margin: 0;">Unsubscribe • Contact • Website</p>
  </div>
</div>`,
    },
    template6: {
      name: "Professional Campaign",
      subject: "Important Update: Q1 2026 Business Highlights",
      html: `<div style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #2c3e50;">
  <div style="background: linear-gradient(90deg, #34495e 0%, #2c3e50 100%); padding: 40px 30px; text-align: left;">
    <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #ecf0f1; margin-bottom: 8px; font-weight: 600;">RARE NEPAL</div>
    <h1 style="font-size: 28px; color: #ecf0f1; margin: 0; font-weight: 400; letter-spacing: 0.5px;">Business Update</h1>
  </div>
  <div style="padding: 40px 30px;">
    <h2 style="font-size: 20px; color: #2c3e50; margin: 0 0 16px 0; font-weight: 500;">Dear Valued Partner,</h2>
    <p style="font-size: 14px; color: #34495e; line-height: 1.8; margin: 0 0 20px 0;">We are pleased to share the highlights and key metrics from our operations this quarter.</p>
    <div style="background: #ecf0f1; border-left: 4px solid #34495e; padding: 20px; margin: 24px 0; border-radius: 4px;">
      <p style="font-size: 13px; color: #2c3e50; margin: 0; font-weight: 500;">📊 Key Metrics</p>
      <p style="font-size: 12px; color: #34495e; margin: 12px 0 0 0; line-height: 1.6;">• Revenue Growth: [+X%]<br>• Customer Satisfaction: [+X%]<br>• Market Expansion: [Details]</p>
    </div>
    <p style="font-size: 14px; color: #34495e; line-height: 1.8; margin: 24px 0;">We continue our commitment to excellence and innovation in the global marketplace.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://rarenp.com" style="display: inline-block; padding: 12px 32px; background: #34495e; color: #ecf0f1; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">VIEW FULL REPORT</a>
    </div>
  </div>
  <div style="background: #34495e; padding: 24px 30px; text-align: center; font-size: 11px; color: #bdc3c7;">
    <p style="margin: 0;">© 2026 RARE Nepal Ltd. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">This is an official business communication.</p>
  </div>
</div>`,
    },
    template7: {
      name: "Corporate Newsletter",
      subject: "Your Monthly Newsletter - March 2026",
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; color: #333;">
  <div style="background: white; padding: 30px; border-bottom: 3px solid #2563eb; text-align: center;">
    <h1 style="font-size: 24px; color: #2563eb; margin: 0; font-weight: 600; letter-spacing: -0.5px;">RARE Newsletter</h1>
    <p style="font-size: 12px; color: #666; margin: 8px 0 0 0; letter-spacing: 0.5px;">MONTHLY INSIGHTS & UPDATES</p>
  </div>
  <div style="background: white; padding: 30px; margin: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
    <h2 style="font-size: 18px; color: #2563eb; margin: 0 0 12px 0; font-weight: 600;">Featured Story</h2>
    <p style="font-size: 14px; color: #555; line-height: 1.8; margin: 0 0 16px 0;">This month, we highlight the latest developments in our organization, emerging trends, and opportunities ahead.</p>
    <a href="https://rarenp.com" style="display: inline-block; padding: 10px 24px; background: #2563eb; color: white; text-decoration: none; font-size: 12px; font-weight: 600; border-radius: 4px;">READ MORE</a>
  </div>
  <div style="padding: 0 30px;">
    <h3 style="font-size: 14px; color: #333; font-weight: 600; margin: 24px 0 12px 0;">What's New</h3>
    <div style="background: white; padding: 16px; margin-bottom: 12px; border-left: 3px solid #2563eb; border-radius: 2px;">
      <p style="font-size: 12px; color: #666; margin: 0; font-weight: 600;">New Product Launch</p>
      <p style="font-size: 12px; color: #888; margin: 4px 0 0 0;">Introducing our latest innovation in Q1</p>
    </div>
    <div style="background: white; padding: 16px; border-left: 3px solid #2563eb; border-radius: 2px;">
      <p style="font-size: 12px; color: #666; margin: 0; font-weight: 600;">Team Recognition</p>
      <p style="font-size: 12px; color: #888; margin: 4px 0 0 0;">Celebrating our outstanding team members</p>
    </div>
  </div>
  <div style="background: #f5f5f5; padding: 24px 30px; text-align: center; font-size: 11px; color: #888; margin-top: 24px;">
    <p style="margin: 0;">RARE Newsletter | © 2026</p>
  </div>
</div>`,
    },
    template8: {
      name: "Product Launch Announcement",
      subject: "🎉 Introducing: Revolutionary Product Launch",
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: white;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 30px; text-align: center; color: white;">
    <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
    <h1 style="font-size: 32px; margin: 0 0 12px 0; font-weight: 700;">Revolutionary Launch</h1>
    <p style="font-size: 16px; margin: 0; opacity: 0.95;">Introducing Something Extraordinary</p>
  </div>
  <div style="padding: 40px 30px; text-align: center;">
    <h2 style="font-size: 22px; color: #2c3e50; margin: 0 0 16px 0; font-weight: 600;">What's New?</h2>
    <p style="font-size: 14px; color: #555; line-height: 1.8; margin: 0 0 24px 0;">We're excited to announce the availability of our breakthrough product designed to transform the way you work and create.</p>
    <div style="display: inline-block; background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: left; font-size: 13px; color: #555; line-height: 1.7;">
      <strong style="color: #667eea;">Key Features:</strong><br>
      ✓ Advanced capabilities<br>
      ✓ Seamless integration<br>
      ✓ Unmatched performance<br>
      ✓ Enterprise-ready security
    </div>
    <div style="margin: 32px 0;">
      <a href="https://rarenp.com" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 14px; letter-spacing: 0.5px;">LEARN MORE & GET EARLY ACCESS</a>
    </div>
    <p style="font-size: 12px; color: #888; margin: 20px 0 0 0;">Limited time offer for early adopters</p>
  </div>
  <div style="background: #f8f9fa; padding: 24px 30px; text-align: center; font-size: 11px; color: #999;">
    <p style="margin: 0;">© 2026 RARE Nepal. All rights reserved.</p>
  </div>
</div>`,
    },
    template9: {
      name: "Quarterly Business Report",
      subject: "Q1 2026 Performance Report - Key Insights Inside",
      html: `<div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: white; color: #2c3e50;">
  <div style="background: #1e293b; padding: 40px 30px; text-align: center; border-bottom: 4px solid #3b82f6;">
    <h1 style="font-size: 26px; color: white; margin: 0 0 8px 0; font-weight: 600;">Quarterly Report</h1>
    <p style="font-size: 13px; color: #cbd5e1; margin: 0; letter-spacing: 1px;">Q1 2026 - BUSINESS PERFORMANCE</p>
  </div>
  <div style="padding: 40px 30px;">
    <p style="font-size: 14px; color: #555; margin: 0 0 20px 0; line-height: 1.8;">Dear Stakeholders,</p>
    <p style="font-size: 14px; color: #555; margin: 0 0 24px 0; line-height: 1.8;">We are pleased to present our comprehensive quarterly performance report highlighting significant achievements and strategic initiatives.</p>

    <div style="margin: 24px 0; padding: 0;">
      <h3 style="font-size: 14px; color: #1e293b; margin: 0 0 12px 0; font-weight: 600; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Financial Overview</h3>
      <table style="width: 100%; margin-top: 12px; font-size: 13px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 0; color: #555;">Revenue</td>
          <td style="padding: 8px 0; text-align: right; color: #2c3e50; font-weight: 600;">$X,XXX,XXX</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 0; color: #555;">Growth Rate</td>
          <td style="padding: 8px 0; text-align: right; color: #16a34a; font-weight: 600;">+XX%</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 0; color: #555;">Market Share</td>
          <td style="padding: 8px 0; text-align: right; color: #2c3e50; font-weight: 600;">XX%</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #555;">Customer Satisfaction</td>
          <td style="padding: 8px 0; text-align: right; color: #2c3e50; font-weight: 600;">XX/100</td>
        </tr>
      </table>
    </div>

    <div style="margin: 24px 0; padding: 16px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="font-size: 13px; color: #1e293b; margin: 0; font-weight: 600;">Strategic Initiatives</p>
      <p style="font-size: 12px; color: #555; margin: 8px 0 0 0; line-height: 1.6;">• Market expansion in key regions<br>• Product innovation pipeline<br>• Team development programs</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="https://rarenp.com" style="display: inline-block; padding: 12px 32px; background: #3b82f6; color: white; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">VIEW DETAILED REPORT</a>
    </div>
  </div>
  <div style="background: #f1f5f9; padding: 24px 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0;">RARE Nepal | Confidential Business Communication</p>
    <p style="margin: 8px 0 0 0;">© 2026 All rights reserved.</p>
  </div>
</div>`,
    },
  } as Record<string, { name: string; subject: string; html: string }>;

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

  const addEmailMutation = useMutation({
    mutationFn: async () => {
      if (!newSubscriberEmail.trim()) throw new Error("Email is required");
      const result = await addNewsletterEmail(newSubscriberEmail);
      if (!result.success) throw new Error(result.message || "Failed to add email");
      return result;
    },
    onSuccess: () => {
      toast({ title: "Email added successfully" });
      setNewSubscriberEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin", "newsletter", "subscribers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add email", description: err.message, variant: "destructive" });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const result = await deleteNewsletterEmail(email);
      if (!result.success) throw new Error(result.message || "Failed to delete email");
      return result;
    },
    onSuccess: () => {
      toast({ title: "Email removed successfully" });
      setDeleteConfirmEmail(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "newsletter", "subscribers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete email", description: err.message, variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const result = await deleteAllNewsletterEmails();
      if (!result.success) throw new Error(result.message || "Failed to clear subscribers");
      return result;
    },
    onSuccess: () => {
      toast({ title: "All subscribers cleared" });
      queryClient.invalidateQueries({ queryKey: ["admin", "newsletter", "subscribers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to clear subscribers", description: err.message, variant: "destructive" });
    },
  });

  const importEmailsMutation = useMutation({
    mutationFn: async (csvText: string) => {
      const emails = csvText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.includes("@"))
        .map((line) => {
          const parts = line.split(",");
          return parts[0].trim();
        });

      if (emails.length === 0) throw new Error("No valid emails found in file");
      const result = await importNewsletterEmails(emails);
      if (!result.success) throw new Error(result.message || "Failed to import emails");
      return result;
    },
    onSuccess: (result: any) => {
      toast({
        title: "Import successful",
        description: `Added ${result.added} new emails out of ${result.total} total`,
      });
      setIsImportDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "newsletter", "subscribers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      importEmailsMutation.mutate(text);
    };
    reader.readAsText(file);
  };

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
        setIsBroadcastConfirmOpen(false);
      } else {
        toast({ title: result.error || "Failed to send broadcast", variant: "destructive" });
      }
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
              <div
                className="relative w-20 h-20 rounded-full bg-[#2D4A35] text-white flex items-center justify-center text-2xl font-semibold overflow-hidden cursor-pointer group"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                {profileImage || user?.profileImageUrl ? (
                  <img
                    src={profileImage || user?.profileImageUrl || ""}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (user?.name || user?.email || "U")
                    .slice(0, 2)
                    .toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = reader.result as string;
                    avatarMutation.mutate(base64);
                  };
                  reader.readAsDataURL(file);
                }}
              />
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
                      disabled={emailChangeMutation.isPending}
                      onClick={() => emailChangeMutation.mutate(editEmail)}
                    >
                      {emailChangeMutation.isPending ? "Sending..." : "Verify & Update"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={profileMutation.isPending || displayName === (user?.name ?? "")}
                  className="h-10"
                  onClick={() => profileMutation.mutate({ displayName })}
                >
                  {profileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Email Verification Dialog */}
        <Dialog open={isEmailVerifyOpen} onOpenChange={setIsEmailVerifyOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Verify Email Change</DialogTitle>
              <DialogDescription>
                Enter the 6-digit verification code sent to <strong>{editEmail}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {emailOtpCode && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Dev Fallback Code:</p>
                  <p className="text-2xl font-bold tracking-[8px] text-amber-800 dark:text-amber-300 text-center">{emailOtpCode}</p>
                </div>
              )}
              <Input
                placeholder="Enter 6-digit code"
                value={emailVerifyCode}
                onChange={(e) => setEmailVerifyCode(e.target.value)}
                className="text-center text-lg tracking-[6px] h-12"
                maxLength={6}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEmailVerifyOpen(false)}>Cancel</Button>
              <Button
                disabled={emailVerifyMutation.isPending || emailVerifyCode.length < 4}
                onClick={() => {
                  emailVerifyMutation.mutate({
                    tempToken: emailTempToken,
                    code: emailVerifyCode,
                    newEmail: editEmail,
                  });
                }}
              >
                {emailVerifyMutation.isPending ? "Verifying..." : "Verify & Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4 space-y-6">
          <Suspense fallback={<div className="p-10 text-center animate-pulse text-xs tracking-widest text-muted-foreground uppercase">Initialising secure protocols...</div>}>
            <SecuritySection />
          </Suspense>

          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground text-center">
              Account Security & Credentials
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
                                className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => {
                                  setDeleteUserId(u.id);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
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

        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete this user? This action <strong>cannot be undone</strong>. All associated data including roles and permissions will be removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setDeleteUserId(null); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteUserId) deleteMutation.mutate(deleteUserId);
                }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create User tab */}
        {isAdmin && (
          <TabsContent value="invite" className="mt-4">
            <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Create User
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
                  <button
                    type="button"
                    className="ml-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Custom roles coming soon"
                    onClick={() => toast({ title: "Coming soon", description: "Custom role creation will be available in a future update." })}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </button>
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
                  Create User
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
          {/* Newsletter Subscribers Management */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Newsletter Subscribers
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage your community ({subscribers.length} total)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs font-mono tracking-tighter"
                  onClick={() => exportSubscribersCSV()}
                >
                  <Download className="h-3 w-3 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Manual Add Email */}
            <div className="space-y-2 pb-4 border-b border-[#E5E5E0] dark:border-border">
              <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Add Email</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="name@example.com" 
                  value={newSubscriberEmail}
                  onChange={(e) => setNewSubscriberEmail(e.target.value)}
                  className="h-9 px-3 text-sm"
                />
                <Button 
                  size="sm" 
                  className="bg-[#2C3E2D] hover:bg-[#2C3E2D]/90"
                  onClick={() => addEmailMutation.mutate()}
                  disabled={addEmailMutation.isPending || !newSubscriberEmail.trim()}
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                  Add
                </Button>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Email List</DialogTitle>
                      <DialogDescription>Upload a CSV file with email addresses (one per line or comma-separated)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <input 
                        type="file" 
                        accept=".csv,.xlsx,.xls" 
                        onChange={handleImportFile}
                        disabled={importEmailsMutation.isPending}
                        className="w-full text-sm"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search emails..." 
                className="h-8 w-full pl-9 text-xs"
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
              />
            </div>

            {/* Subscribers Table */}
            <div className="border border-[#E5E5E0] dark:border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-[#E5E5E0] dark:border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Email Address</th>
                    <th className="px-4 py-2 text-left font-semibold">Joined</th>
                    <th className="px-4 py-2 text-right font-semibold">Actions</th>
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
                        No subscribers to display.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscribers.slice(0, 20).map((s) => (
                      <tr key={s.email} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-medium text-xs">{s.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.createdAt ? format(new Date(s.createdAt), "MMM d") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Dialog open={deleteConfirmEmail === s.email} onOpenChange={(open) => !open && setDeleteConfirmEmail(null)}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setDeleteConfirmEmail(s.email)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Remove Subscriber</DialogTitle>
                                <DialogDescription>Are you sure you want to remove {s.email}?</DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteConfirmEmail(null)}>Cancel</Button>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => deleteEmailMutation.mutate(s.email)}
                                  disabled={deleteEmailMutation.isPending}
                                >
                                  {deleteEmailMutation.isPending ? "Removing..." : "Remove"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))
                  )}
                  {filteredSubscribers.length > 20 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-center text-[10px] text-muted-foreground bg-muted/5">
                        Showing first 20 of {filteredSubscribers.length} subscribers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bulk Actions */}
            {subscribers.length > 0 && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5E0] dark:border-border">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Clear All
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Clear All Subscribers</DialogTitle>
                      <DialogDescription>This action cannot be undone. Are you absolutely sure you want to delete all {subscribers.length} subscribers?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => deleteAllMutation.mutate()}
                        disabled={deleteAllMutation.isPending}
                      >
                        {deleteAllMutation.isPending ? "Clearing..." : "Clear All"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Email Content Editor with Advanced Features */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Advanced Email Composer
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Professional editor with syntax highlighting, live preview, and element styling
                </p>
              </div>
            </div>

            {/* Template Selector with Search */}
            <div className="space-y-3">
              <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Templates</label>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search templates..." 
                  className="h-9 pl-9 text-sm"
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value.toLowerCase())}
                />
              </div>

              {/* Template Selector */}
              <select 
                value={selectedTemplate}
                onChange={(e) => {
                  const tpl = emailTemplates[e.target.value as keyof typeof emailTemplates];
                  setSelectedTemplate(e.target.value);
                  setMarketingSubject(tpl.subject);
                  setMarketingBody(tpl.html);
                  setTemplateSearchQuery("");
                }}
                className="w-full h-9 px-3 text-sm border border-[#E5E5E0] dark:border-border rounded-md bg-white dark:bg-card"
              >
                <option value="">-- Select Template --</option>
                {Object.entries(emailTemplates)
                  .filter(([_, template]) => template.name.toLowerCase().includes(templateSearchQuery))
                  .map(([key, template]) => (
                    <option key={key} value={key}>{template.name}</option>
                  ))
                }
              </select>
            </div>

            {/* Advanced Email Editor */}
            <AdvancedEmailEditor
              htmlContent={marketingBody}
              onHtmlChange={setMarketingBody}
              showSplitView={showSplitEditor}
              onSplitViewChange={setShowSplitEditor}
            />
          </div>

          {/* Broadcast Settings */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Email Broadcast
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Send to {filteredSubscribers.length} subscribers
                </p>
              </div>
              <Badge variant="outline" className="bg-[#2D4A35]/5 text-[#2D4A35] dark:text-emerald-400 border-[#2D4A35]/20">
                <Mail className="h-3 w-3 mr-1.5" />
                {subscribers.length} Recipients
              </Badge>
            </div>

            <div className="space-y-4">
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
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E5E5E0] dark:border-border">
              <p className="text-xs text-muted-foreground italic">
                Will send immediately to all subscribers via BCC
              </p>
              <Dialog open={isBroadcastConfirmOpen} onOpenChange={setIsBroadcastConfirmOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-[#2C3E2D] hover:bg-[#2C3E2D]/90 px-8"
                    disabled={!marketingSubject.trim() || !marketingBody.trim() || subscribers.length === 0}
                  >
                    <Send className="h-3.5 w-3.5 mr-2" />
                    Send Broadcast
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Broadcast</DialogTitle>
                    <DialogDescription>
                      This will send an email to {subscribers.length} subscribers. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm">{marketingSubject}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Recipients</p>
                      <p className="text-sm">{subscribers.length} subscribers</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBroadcastConfirmOpen(false)}>Cancel</Button>
                    <Button 
                      className="bg-[#2C3E2D] hover:bg-[#2C3E2D]/90"
                      onClick={() => {
                        broadcastMutation.mutate({
                          subject: marketingSubject,
                          html: marketingBody
                        });
                      }}
                      disabled={broadcastMutation.isPending}
                    >
                      {broadcastMutation.isPending ? "Sending..." : "Send to All"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

