import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { CanvasSection } from "@/lib/adminApi";
import { getSectionLabel, resolveSectionTypeDefinition } from "@/lib/sectionTypes";
import { cn } from "@/lib/utils";

interface SortableSectionItemProps {
  section: CanvasSection;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onRename: (id: number, label: string) => void;
  onToggleVisibility: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
}

function TinySectionPreview({ section }: { section: CanvasSection }) {
  const definition = resolveSectionTypeDefinition(section);
  const label = definition?.label ?? section.sectionType;
  const toneClassName =
    definition?.category === "hero"
      ? "bg-[linear-gradient(135deg,#1a1510_0%,#0f0f10_100%)]"
      : definition?.category === "products"
        ? "bg-[linear-gradient(135deg,#15171f_0%,#111113_100%)]"
        : definition?.category === "content"
          ? "bg-[linear-gradient(135deg,#20180d_0%,#121214_100%)]"
          : definition?.category === "media"
            ? "bg-[linear-gradient(135deg,#102118_0%,#111113_100%)]"
            : definition?.category === "interactive"
              ? "bg-[linear-gradient(135deg,#171520_0%,#101012_100%)]"
              : "bg-[linear-gradient(135deg,#121212_0%,#17171a_100%)]";

  return (
    <div
      className={cn(
        "flex h-[30px] w-[44px] items-center justify-center overflow-hidden rounded-md border border-white/10 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#c9a84c]",
        toneClassName,
      )}
    >
      <span className="line-clamp-2 px-1 text-center leading-tight">{label}</span>
    </div>
  );
}

function SortableSectionItem({
  section,
  isSelected,
  onSelect,
  onRename,
  onToggleVisibility,
  onDuplicate,
  onDelete,
}: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const definition = resolveSectionTypeDefinition(section);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(getSectionLabel(section));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraftLabel(getSectionLabel(section));
  }, [section]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const normalizedTypeLabel = (definition?.label ?? section.sectionType)
    .replace(/\s+/g, " ")
    .toUpperCase();

  const commitRename = () => {
    const next = draftLabel.trim();
    setIsEditing(false);
    if (!next || next === (section.label ?? "").trim()) return;
    onRename(section.id, next);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-white/8 bg-[#111113] transition-all",
        isSelected
          ? "border-[#c9a84c]/25 bg-[#151519] shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
          : "hover:border-white/12 hover:bg-[#151518]",
        !section.isVisible && "opacity-55",
        isDragging && "opacity-70 shadow-[0_18px_34px_rgba(0,0,0,0.35)]",
      )}
      onClick={() => onSelect(section.id)}
    >
      {isSelected ? <div className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-[#c9a84c]" /> : null}
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="hidden shrink-0 cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing group-hover:inline-flex"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <TinySectionPreview section={section} />

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              value={draftLabel}
              autoFocus
              onChange={(event) => setDraftLabel(event.target.value)}
              onBlur={commitRename}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftLabel(getSectionLabel(section));
                  setIsEditing(false);
                }
              }}
              className="h-8 border-white/10 bg-white/[0.04] text-sm text-foreground"
            />
          ) : (
            <button
              type="button"
              className="block max-w-full text-left"
              onClick={(event) => {
                event.stopPropagation();
                setIsEditing(true);
              }}
            >
              <p
                className={cn(
                  "truncate text-sm font-medium text-foreground",
                  !section.isVisible && "line-through",
                )}
              >
                {getSectionLabel(section)}
              </p>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {normalizedTypeLabel}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(section.id);
            }}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            title="Duplicate section"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility(section.id);
            }}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            title={section.isVisible ? "Hide section" : "Show section"}
          >
            {section.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmDelete((current) => !current);
            }}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete section"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex items-center justify-end gap-2 border-t border-white/8 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Delete?</span>
          <button
            type="button"
            className="font-semibold text-[#c9a84c]"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(section.id);
            }}
          >
            Yes
          </button>
          <button
            type="button"
            className="text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmDelete(false);
            }}
          >
            No
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface SortableSectionListProps {
  sections: CanvasSection[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onRename: (id: number, label: string) => void;
  onToggleVisibility: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
}

export function SortableSectionList({
  sections,
  selectedId,
  onSelect,
  onReorder,
  onRename,
  onToggleVisibility,
  onDuplicate,
  onDelete,
}: SortableSectionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [orderedSections, setOrderedSections] = useState(sections);

  useEffect(() => {
    setOrderedSections(sections);
  }, [sections]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedSections.findIndex((section) => section.id === active.id);
    const newIndex = orderedSections.findIndex((section) => section.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(orderedSections, oldIndex, newIndex);
    setOrderedSections(newOrder);
    onReorder(newOrder.map((section) => section.id));
  }

  if (orderedSections.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {orderedSections.map((section) => (
            <div key={section.id} data-section-row-id={section.id}>
              <SortableSectionItem
                section={section}
                isSelected={selectedId === section.id}
                onSelect={onSelect}
                onRename={onRename}
                onToggleVisibility={onToggleVisibility}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
