import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createCanvasPage } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface CreatePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (pageId: number) => void;
  templateId?: number | null;
  templateName?: string | null;
}

export function CreatePageDialog({
  open,
  onOpenChange,
  onSuccess,
  templateId = null,
  templateName = null,
}: CreatePageDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  function autoSlug(value: string) {
    setTitle(value);
    if (!slug) {
      setSlug("/" + value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: { title: string; slug: string; fromTemplateId?: number }) => createCanvasPage(data),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
      toast({ title: "Page created", description: `"${page.title}" has been created.` });
      setTitle("");
      setSlug("");
      onOpenChange(false);
      onSuccess?.(page.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create page.", variant: "destructive" });
    },
  });

  function handleCreate() {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a page title.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      slug: slug || "/" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ...(templateId ? { fromTemplateId: templateId } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {templateId ? "Create Page From Template" : "Create New Page"}
          </DialogTitle>
          <DialogDescription>
            {templateId
              ? `Create a new page using ${templateName ?? "the selected template"} as the starting layout.`
              : "Create a blank page to start building with sections."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Page Title</Label>
            <Input
              value={title}
              onChange={(e) => autoSlug(e.target.value)}
              placeholder="About Us"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>URL Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="/about-us"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending
              ? "Creating..."
              : templateId
                ? "Create From Template"
                : "Create Blank Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
