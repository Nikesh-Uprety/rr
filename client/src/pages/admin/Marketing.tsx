import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdvancedEmailEditor } from "@/components/admin/AdvancedEmailEditor";
import {
  exportSubscribersCSV,
  addNewsletterEmail,
  importNewsletterEmails,
  deleteNewsletterEmail,
  deleteAllNewsletterEmails,
} from "@/lib/adminApi";
import { format } from "date-fns";
import {
  Search,
  Mail,
  MessageSquare,
  Send,
  Download,
  Trash2,
  PlusCircle,
  Upload,
  Eye,
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
} as const;

export default function AdminMarketingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [marketingSubject, setMarketingSubject] = useState("New Seasonal Collection — RARE ATELIER");
  const [marketingBody, setMarketingBody] = useState("");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [newSubscriberEmail, setNewSubscriberEmail] = useState("");
  const [showSplitEditor, setShowSplitEditor] = useState(true);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("template6");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBroadcastConfirmOpen, setIsBroadcastConfirmOpen] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");

  const subscribersQuery = useQuery<{ success: boolean; data: { email: string; createdAt: string }[] }>({
    queryKey: ["admin", "newsletter", "subscribers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/newsletter/subscribers");
      return res.json();
    },
  });

  const subscribers = subscribersQuery.data?.data ?? [];
  const filteredSubscribers = subscribers.filter(s =>
    s.email.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

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
  });

  const broadcastMutation = useMutation({
    mutationFn: async (payload: { subject: string; html: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/broadcast", payload);
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: `Broadcast sent to ${result.count} subscribers` });
        setIsBroadcastConfirmOpen(false);
      }
    },
  });
  
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/test-broadcast", {
        subject: marketingSubject,
        html: marketingBody,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Test email sent to your inbox" });
      } else {
        toast({ title: "Failed to send test email", variant: "destructive" });
      }
    },
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const emails = text.split("\n").map(l => l.trim()).filter(l => l && l.includes("@"));
      importNewsletterEmails(emails).then(() => {
        toast({ title: "Import successful" });
        setIsImportDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "newsletter", "subscribers"] });
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your community and send email broadcasts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Subscribers
            </h2>
            <div className="flex gap-2">
              <Input 
                placeholder="Add email..." 
                value={newSubscriberEmail}
                onChange={(e) => setNewSubscriberEmail(e.target.value)}
                className="h-9"
              />
              <Button size="sm" onClick={() => addEmailMutation.mutate()} disabled={addEmailMutation.isPending}>
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto border border-[#E5E5E0] dark:border-border rounded-xl">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
                  {filteredSubscribers.map((s) => (
                    <tr key={s.email} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2 truncate max-w-[150px]">{s.email}</td>
                      <td className="px-4 py-2 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => deleteEmailMutation.mutate(s.email)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Email Composer
              </h2>
              <select 
                value={selectedTemplate}
                onChange={(e) => {
                  const tpl = emailTemplates[e.target.value as keyof typeof emailTemplates];
                  setSelectedTemplate(e.target.value);
                  setMarketingSubject(tpl.subject);
                  setMarketingBody(tpl.html);
                }}
                className="text-xs border rounded p-1 bg-white dark:bg-card"
              >
                {Object.entries(emailTemplates).map(([key, t]) => (
                  <option key={key} value={key}>{t.name}</option>
                ))}
              </select>
            </div>

            <Input 
              placeholder="Subject Line" 
              value={marketingSubject}
              onChange={(e) => setMarketingSubject(e.target.value)}
              className="h-10"
            />

            <AdvancedEmailEditor
              htmlContent={marketingBody}
              onHtmlChange={setMarketingBody}
              showSplitView={showSplitEditor}
              onSplitViewChange={setShowSplitEditor}
              onSendTest={() => sendTestMutation.mutate()}
            />

            <div className="flex justify-end">
              <Button 
                className="bg-[#2C3E2D] hover:bg-[#2C3E2D]/90"
                onClick={() => setIsBroadcastConfirmOpen(true)}
                disabled={!marketingSubject.trim() || !marketingBody.trim() || subscribers.length === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                Broadcast to {subscribers.length}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isBroadcastConfirmOpen} onOpenChange={setIsBroadcastConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Broadcast?</DialogTitle>
            <DialogDescription>
              This will send the email to {subscribers.length} subscribers immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastConfirmOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#2C3E2D]"
              onClick={() => broadcastMutation.mutate({ subject: marketingSubject, html: marketingBody })}
              loading={broadcastMutation.isPending}
              loadingText="Sending..."
            >
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
