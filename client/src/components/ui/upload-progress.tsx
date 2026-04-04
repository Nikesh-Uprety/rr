"use client"

import { useId } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface UploadProgressProps {
  value: number
  label?: string
  className?: string
  id?: string
}

export function UploadProgress({
  value,
  label = "Upload progress",
  className,
  id,
}: UploadProgressProps) {
  const autoId = useId()
  const safeValue = Math.min(100, Math.max(0, Math.round(value)))
  const progressId = id ?? autoId

  return (
    <Field className={cn("w-full max-w-sm", className)}>
      <FieldLabel htmlFor={progressId} className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{label}</span>
        <span className="ml-auto">{safeValue}%</span>
      </FieldLabel>
      <Progress value={safeValue} id={progressId} />
    </Field>
  )
}
