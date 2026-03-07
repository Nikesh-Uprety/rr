import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, isLoading } = useCurrentUser();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const res = await apiRequest("POST", "/api/auth/login", values);
      return (await res.json()) as {
        success: boolean;
        data?: { id: string; email: string; name?: string; role: string };
        error?: string;
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    );
  }

  if (user && (user.role === "admin" || user.role === "staff")) {
    if (location !== "/admin") setLocation("/admin");
    return null;
  }
  if (user) {
    if (location !== "/") setLocation("/");
    return null;
  }

  const onSubmit = async (values: LoginFormValues) => {
    const result = await mutateAsync(values);
    if (!result.success || !result.data) return;

    if (result.data.role !== "admin" && result.data.role !== "staff") {
      toast({
        title: "Staff & admin only",
        description: "This login is for staff and admin. You can checkout as a guest.",
        variant: "default",
      });
      setLocation("/");
      return;
    }
    setLocation("/admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
      <div className="w-full max-w-[400px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg shadow-black/5 dark:shadow-none p-10">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-semibold mb-1">
            RARE.NP
          </p>
          <p className="text-xs text-muted-foreground tracking-wide">
            Admin & staff sign in
          </p>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Sign in to access the admin panel
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
              className="h-12 rounded-lg border-neutral-200 dark:border-neutral-700 bg-background focus-visible:ring-2"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className="h-12 pr-12 rounded-lg border-neutral-200 dark:border-neutral-700 bg-background focus-visible:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg">
              {(error as Error).message ?? "Failed to sign in"}
            </p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-12 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-sm font-medium transition-colors"
          >
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs text-muted-foreground">
          &copy; 2025 Rare Atelier. Staff and admin only.
        </p>

        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
            Developer credentials
          </summary>
          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-1 font-mono text-[11px]">
            <p>Admin: admin@rare.np / admin123</p>
            <p>Staff: staff@rare.np / staff123</p>
          </div>
        </details>
      </div>
    </div>
  );
}
