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
import { motion, AnimatePresence } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type LoginStep = "credentials" | "otp";

export default function LoginPage() {
  const { user, isLoading } = useCurrentUser();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null); // Temp code display
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [canResend, setCanResend] = useState(false);

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
        requires2FA?: boolean;
        tempToken?: string;
        code?: string;
        data?: {
          id: string;
          email: string;
          name?: string;
          role: string;
          twoFactorEnabled?: boolean;
        };
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
    if (!result.success) return;

    // 2FA flow
    if (result.requires2FA && result.tempToken) {
      setTempToken(result.tempToken);
      if (result.code) setDevCode(result.code);
      setStep("otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setCanResend(false);
      setTimeout(() => setCanResend(true), 60000);
      toast({
        title: "Check your email",
        description: "We sent a 6-digit code to your email address.",
      });
      return;
    }

    if (!result.data) return;

    if (result.data.role !== "admin" && result.data.role !== "staff") {
      toast({
        title: "Staff & admin only",
        description:
          "This login is for staff and admin. You can checkout as a guest.",
        variant: "default",
      });
      setLocation("/");
      return;
    }
    setLocation("/admin");
  };

  const otpValue = otpDigits.join("");

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`) as
        | HTMLInputElement
        | null;
      prev?.focus();
    }
  };

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!tempToken) throw new Error("Session expired. Please login again.");
      const res = await apiRequest("POST", "/api/auth/verify-2fa", {
        tempToken,
        code: otpValue,
      });
      return (await res.json()) as {
        success: boolean;
        data?: { id: string; email: string; name?: string; role: string };
        error?: string;
      };
    },
    onSuccess: async (result) => {
      if (!result.success) {
        toast({
          title: "Invalid code",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setStep("credentials");
      setTempToken(null);
      setDevCode(null);
      setLocation("/admin");
    },
    onError: (err: Error) => {
      toast({
        title: "Verification failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      if (!tempToken) throw new Error("Session expired. Please login again.");
      const res = await apiRequest("POST", "/api/auth/resend-otp", {
        tempToken,
      });
      return (await res.json()) as { success: boolean; error?: string; code?: string };
    },
    onSuccess: (result) => {
      if (result.code) setDevCode(result.code);
      setCanResend(false);
      setTimeout(() => setCanResend(true), 60000);
      toast({
        title: "Code resent",
        description: "Check your email for a new verification code.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Unable to resend",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12 admin-font">
      <div className="w-full max-w-[400px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg shadow-black/5 dark:shadow-none p-10">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.35em] text-neutral-400 font-bold mb-1">
            RARE.NP
          </p>
        </div>

        {step === "credentials" && (
          <>
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
                  <p className="text-xs text-red-500">
                    {errors.email.message}
                  </p>
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg">
                  {(error as Error).message ?? "Failed to sign in"}
                </p>
              )}

              <div className="relative pt-2">
                <div className="flex justify-center">
                  <motion.button
                    type="submit"
                    disabled={isPending}
                    initial={false}
                    animate={isPending ? "loading" : "idle"}
                    variants={{
                      idle: { width: "100%", height: "48px", borderRadius: "8px" },
                      loading: { width: "140px", height: "12px", borderRadius: "100px" }
                    }}
                    className="flex items-center justify-center relative bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 overflow-hidden cursor-pointer disabled:cursor-not-allowed group transition-colors duration-500"
                  >
                    <AnimatePresence mode="wait">
                      {!isPending ? (
                        <motion.span
                          key="text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-sm font-bold uppercase tracking-[0.2em]"
                        >
                          Sign in
                        </motion.span>
                      ) : (
                        <motion.div
                          key="loader"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full relative overflow-hidden"
                        >
                          <motion.div
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-neutral-400 dark:bg-neutral-300 w-1/2"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a 6-digit code to your email. Enter it below to complete
              sign in.
            </p>
            
            {devCode && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                <p className="font-semibold mb-1">SMTP is currently unavailable.</p>
                <p>Your temporary verification code is: <span className="font-bold text-amber-900 dark:text-amber-100">{devCode}</span></p>
              </div>
            )}
            
            <div className="flex items-center justify-center mb-4">
              <div className="flex gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      handleOtpChange(index, e.target.value);
                      if (e.target.value && index < 5) {
                        const next = document.getElementById(
                          `otp-${index + 1}`,
                        ) as HTMLInputElement | null;
                        next?.focus();
                      }
                    }}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-10 h-12 text-center text-lg font-semibold"
                  />
                ))}
              </div>
            </div>
            
            <div className="relative pt-2">
              <div className="flex justify-center">
                <motion.button
                  type="button"
                  disabled={otpValue.length !== 6 || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate()}
                  initial={false}
                  animate={verifyMutation.isPending ? "loading" : "idle"}
                  variants={{
                    idle: { width: "100%", height: "48px", borderRadius: "8px" },
                    loading: { width: "140px", height: "12px", borderRadius: "100px" }
                  }}
                  className="flex items-center justify-center relative bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 overflow-hidden cursor-pointer disabled:cursor-not-allowed mb-3 group transition-colors duration-500"
                >
                  <AnimatePresence mode="wait">
                    {!verifyMutation.isPending ? (
                      <motion.span
                        key="text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-bold uppercase tracking-[0.2em]"
                      >
                        Verify Code
                      </motion.span>
                    ) : (
                      <motion.div
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full relative overflow-hidden"
                      >
                        <motion.div
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-0 bg-neutral-400 dark:bg-neutral-300 w-1/2"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>

            <button
              type="button"
              disabled={!canResend || resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center mt-3 disabled:opacity-50"
            >
              Didn&apos;t receive it? Resend code
            </button>
          </>
        )}

        <p className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs text-muted-foreground uppercase tracking-widest opacity-40">
          &copy; 2025 Rare Atelier. 
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
