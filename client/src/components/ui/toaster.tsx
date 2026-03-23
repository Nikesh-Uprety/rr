import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const timersRef = React.useRef<Record<string, number>>({})
  const startTimesRef = React.useRef<Record<string, number>>({})
  const durationsRef = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    toasts.forEach((toast) => {
      if (!durationsRef.current[toast.id]) {
        const variant = (toast as any).variant as string | undefined
        const explicitDuration = (toast as any).duration as number | undefined
        const duration =
          explicitDuration ??
          (variant === "destructive"
            ? 5000
            : variant === "warning"
              ? 4000
              : 3000)

        durationsRef.current[toast.id] = duration
        startTimesRef.current[toast.id] = performance.now()
        setProgress((prev) => ({ ...prev, [toast.id]: 100 }))

        const timerId = window.setInterval(() => {
          const start = startTimesRef.current[toast.id]
          const dur = durationsRef.current[toast.id]
          if (!start || !dur) return

          const elapsed = performance.now() - start
          const remaining = Math.max(0, dur - elapsed)
          const pct = (remaining / dur) * 100

          setProgress((prev) => ({ ...prev, [toast.id]: pct }))

          if (remaining <= 0) {
            window.clearInterval(timerId)
            delete timersRef.current[toast.id]
          }
        }, 50)

        timersRef.current[toast.id] = timerId
      }
    })

    // Clean up timers for removed toasts
    Object.keys(durationsRef.current).forEach((id) => {
      if (!toasts.find((t) => t.id === id)) {
        const timerId = timersRef.current[id]
        if (timerId) {
          window.clearInterval(timerId)
          delete timersRef.current[id]
        }
        delete durationsRef.current[id]
        delete startTimesRef.current[id]
        setProgress((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    })

    return () => {
      Object.values(timersRef.current).forEach((timerId) =>
        window.clearInterval(timerId)
      )
      timersRef.current = {}
    }
  }, [toasts])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any).variant as string | undefined
        const explicitDuration = (props as any).duration as number | undefined
        const duration =
          explicitDuration ??
          (variant === "destructive"
            ? 5000
            : variant === "warning"
              ? 4000
              : 3000)
        const pct = progress[id] ?? 100

        return (
          <Toast key={id} {...props} duration={duration}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/10/60 dark:bg-white/10/60">
              <div
                className={
                  variant === "destructive"
                    ? "h-full bg-red-400"
                    : variant === "warning"
                      ? "h-full bg-amber-300"
                      : variant === "info"
                        ? "h-full bg-sky-300"
                      : variant === "success"
                        ? "h-full bg-emerald-300"
                        : "h-full bg-foreground/40"
                }
                style={{ width: `${pct}%` }}
              />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
