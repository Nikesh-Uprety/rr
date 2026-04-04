import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Eye, Reply, Send } from "lucide-react";
import { Pagination } from "@/components/admin/Pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

type DateFilter = "1d" | "2d" | "7d" | "all";

export default function MessagesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [messagePage, setMessagePage] = useState(1);
  const MESSAGE_PAGE_SIZE = 15;

  const messagesQuery = useQuery<{ success: boolean; data: ContactMessage[] }>({
    queryKey: ["admin", "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/messages");
      return res.json();
    },
  });

  const messages = messagesQuery.data?.data ?? [];

  const filteredMessages = useMemo(() => {
    if (dateFilter === "all") {
      return messages;
    }

    const daysMap: Record<Exclude<DateFilter, "all">, number> = {
      "1d": 1,
      "2d": 2,
      "7d": 7,
    };

    const threshold = Date.now() - daysMap[dateFilter] * 24 * 60 * 60 * 1000;
    return messages.filter((msg) => {
      const createdAtTime = new Date(msg.createdAt).getTime();
      return Number.isFinite(createdAtTime) && createdAtTime >= threshold;
    });
  }, [messages, dateFilter]);

  const messageTotalPages = Math.max(1, Math.ceil(filteredMessages.length / MESSAGE_PAGE_SIZE));
  const paginatedMessages = filteredMessages.slice(
    (messagePage - 1) * MESSAGE_PAGE_SIZE,
    messagePage * MESSAGE_PAGE_SIZE,
  );

  const unreadCount = filteredMessages.filter((msg) => msg.status === "unread").length;
  const repliedCount = filteredMessages.filter((msg) => msg.status === "replied").length;
  const unreadAllCount = messages.filter((msg) => msg.status === "unread").length;

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
      }
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/messages/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/admin/messages/read-all");
      return res.json() as Promise<{ success: boolean; updatedCount: number }>;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title:
            result.updatedCount > 0
              ? `Marked ${result.updatedCount} messages as read`
              : "All messages are already marked as read",
        });
        queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      }
    },
  });

  const handleView = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setIsViewOpen(true);
    if (msg.status === "unread") {
      markReadMutation.mutate(msg.id);
    }
  };

  const handleReply = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setIsViewOpen(false);
    setIsReplyOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border overflow-hidden">
        <div className="p-4 border-b border-[#E5E5E0] dark:border-border bg-muted/30">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Customer Inquiries
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                <Badge variant="default" className="bg-blue-600">{unreadCount} New</Badge>
                <Badge variant="outline">{filteredMessages.length - unreadCount - repliedCount} Read</Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/50">
                  {repliedCount} Replied
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  disabled={markAllReadMutation.isPending || unreadAllCount === 0}
                  onClick={() => markAllReadMutation.mutate()}
                >
                  {markAllReadMutation.isPending ? "Marking..." : "Read All"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Sort by
              </span>
              {[
                { key: "1d" as const, label: "1 day" },
                { key: "2d" as const, label: "2 days" },
                { key: "7d" as const, label: "7 days" },
                { key: "all" as const, label: "All time" },
              ].map((filterOption) => (
                <Button
                  key={filterOption.key}
                  variant={dateFilter === filterOption.key ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-3 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  onClick={() => setDateFilter(filterOption.key)}
                >
                  {filterOption.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.18em] text-muted-foreground border-b border-[#E5E5E0] dark:border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">S.N.</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Sender</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB] dark:divide-border">
              {messagesQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Loading messages...
                  </td>
                </tr>
              )}
              {!messagesQuery.isLoading && filteredMessages.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No customer messages yet.
                  </td>
                </tr>
              )}
              {!messagesQuery.isLoading && paginatedMessages.map((msg, index) => (
                <tr
                  key={msg.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/20 transition-colors",
                    msg.status === "unread" && "bg-blue-50/30 dark:bg-blue-900/10",
                  )}
                  onClick={() => handleView(msg)}
                >
                  <td className="px-6 py-4 font-medium text-[12px]">{index + 1}</td>
                  <td className="px-6 py-4">
                    {msg.status === "replied" ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/50">Replied</Badge>
                    ) : msg.status === "unread" ? (
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
                    <div className="inline-flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleView(msg);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleReply(msg);
                        }}
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm mt-4">
        <Pagination
          currentPage={messagePage}
          totalPages={messageTotalPages}
          onPageChange={setMessagePage}
          totalItems={filteredMessages.length}
          pageSize={MESSAGE_PAGE_SIZE}
        />
      </div>

      {/* View Message Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedMessage?.name} ({selectedMessage?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 whitespace-pre-wrap text-sm border-y border-border my-4">
            {selectedMessage?.message}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button className="bg-[#2C3E2D]" onClick={() => handleReply(selectedMessage!)}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to {selectedMessage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/40 rounded-lg text-xs italic border border-border opacity-70">
              "{selectedMessage?.message.substring(0, 200)}..."
            </div>
            <Textarea 
              placeholder="Type your response here..." 
              className="min-h-[200px]"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#2C3E2D]"
              disabled={replyMutation.isPending || !replyText.trim()}
              onClick={() => {
                replyMutation.mutate({
                  id: selectedMessage!.id,
                  to: selectedMessage!.email,
                  subject: `Re: ${selectedMessage!.subject}`,
                  html: `<div style="font-family: sans-serif; padding: 20px;">
                    <p>${replyText.replace(/\n/g, '<br>')}</p>
                    <hr style="margin: 20px 0;"/>
                    <p style="font-size: 11px; color: #666;">Original Message from ${selectedMessage?.name}:</p>
                    <div style="color: #666; font-style: italic;">${selectedMessage?.message}</div>
                  </div>`
                });
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
