import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { canAccessAdminPanel } from "@shared/auth-policy";
import { getDefaultAdminPath } from "@/lib/adminAccess";
import {
  ADMIN_FONT_EVENT,
  applyAdminFontSettings,
  readAdminFontSettings,
} from "@/lib/adminFont";
import { cn } from "@/lib/utils";

const OTP_RESEND_COOLDOWN_SECONDS = 50;

function getOtpCooldownStorageKey(tempToken: string) {
  return `otp-resend-available-at:${tempToken}`;
}

function getLoginErrorDetails(error: unknown): {
  message: string | null;
  field: "email" | "password" | null;
} {
  if (!(error instanceof Error)) {
    return { message: null, field: null };
  }

  const match = error.message.match(/\{.*\}$/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as {
        error?: string;
        field?: "email" | "password" | null;
      };
      return {
        message: parsed.error ?? error.message ?? "Failed to sign in",
        field: parsed.field ?? null,
      };
    } catch {
      // Fall back to the original message below.
    }
  }

  return {
    message: error.message || "Failed to sign in",
    field: null,
  };
}

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
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const emailFieldControls = useAnimationControls();
  const passwordFieldControls = useAnimationControls();

  useEffect(() => {
    applyAdminFontSettings(readAdminFontSettings());

    const syncAdminFont = () => {
      applyAdminFontSettings(readAdminFontSettings());
    };

    window.addEventListener(ADMIN_FONT_EVENT, syncAdminFont);
    window.addEventListener("storage", syncAdminFont);

    return () => {
      window.removeEventListener(ADMIN_FONT_EVENT, syncAdminFont);
      window.removeEventListener("storage", syncAdminFont);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || step !== "otp" || !tempToken) {
      setResendSecondsLeft(0);
      return;
    }

    const storageKey = getOtpCooldownStorageKey(tempToken);

    const syncCountdown = () => {
      const stored = Number(window.localStorage.getItem(storageKey) ?? "0");
      if (!Number.isFinite(stored) || stored <= 0) {
        setResendSecondsLeft(0);
        return;
      }

      const secondsLeft = Math.max(0, Math.ceil((stored - Date.now()) / 1000));
      setResendSecondsLeft(secondsLeft);

      if (secondsLeft === 0) {
        window.localStorage.removeItem(storageKey);
      }
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [step, tempToken]);

  const startResendCooldown = (token: string) => {
    if (typeof window === "undefined") return;
    const availableAt = Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000;
    window.localStorage.setItem(getOtpCooldownStorageKey(token), String(availableAt));
    setResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
  };

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, submitCount },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const res = await apiRequest("POST", "/api/auth/login", values);
      return (await res.json()) as {
        success: boolean;
        requires2FA?: boolean;
        tempToken?: string;
        requires2FASetup?: boolean;
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

  if (user && canAccessAdminPanel(user.role)) {
    const nextPath = getDefaultAdminPath(user.role);
    if (location !== nextPath) setLocation(nextPath);
    return null;
  }
  if (user) {
    if (location !== "/") setLocation("/");
    return null;
  }

  const onSubmit = async (values: LoginFormValues) => {
    clearErrors(["email", "password"]);

    let result:
      | {
          success: boolean;
          requires2FA?: boolean;
          tempToken?: string;
          requires2FASetup?: boolean;
          data?: {
            id: string;
            email: string;
            name?: string;
            role: string;
            twoFactorEnabled?: boolean;
          };
          error?: string;
        }
      | undefined;

    try {
      result = await mutateAsync(values);
    } catch (err) {
      const loginError = getLoginErrorDetails(err);
      const fieldName: FieldPath<LoginFormValues> =
        loginError.field === "email" ? "email" : "password";

      setError(fieldName, {
        type: "server",
        message: loginError.message ?? "Failed to sign in",
      });
      return;
    }

    if (!result?.success) return;

    // 2FA flow
    if (result.requires2FA && result.tempToken) {
      setTempToken(result.tempToken);
      setStep("otp");
      setOtpDigits(["", "", "", "", "", ""]);
      startResendCooldown(result.tempToken);
      toast({
        title: "Check your email",
        description: "We sent a 6-digit code to your email address.",
      });
      return;
    }

    if (!result.data) return;

    if (!canAccessAdminPanel(result.data.role)) {
      toast({
        title: "Admin panel access only",
        description:
          "Only admin portal roles can access the admin panel.",
        variant: "default",
      });
      setLocation("/");
      return;
    }
    setLocation(getDefaultAdminPath(result.data.role));
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
      setOtpDigits(["", "", "", "", "", ""]);
      setResendSecondsLeft(0);
      setLocation(getDefaultAdminPath(result.data?.role));
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
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error ?? "Unable to resend the verification code.");
      }
      return json;
    },
    onSuccess: (result) => {
      if (tempToken) {
        startResendCooldown(tempToken);
      }
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

  const canResend = resendSecondsLeft === 0 && !resendMutation.isPending;
  const resendLabel =
    resendSecondsLeft > 0
      ? `Didn't receive it? Resend code in ${resendSecondsLeft}s`
      : "Didn't receive it? Resend code";
  const hasSubmittedLogin = submitCount > 0;
  const showEmailValidationError = hasSubmittedLogin && Boolean(errors.email);
  const showPasswordValidationError = hasSubmittedLogin && Boolean(errors.password);
  const hasEmailAlert = showEmailValidationError;
  const hasPasswordAlert = showPasswordValidationError;

  useEffect(() => {
    if (!hasEmailAlert) {
      return;
    }

    void emailFieldControls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.38, ease: "easeInOut" },
    });
  }, [emailFieldControls, hasEmailAlert]);

  useEffect(() => {
    if (!hasPasswordAlert) {
      return;
    }

    void passwordFieldControls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.38, ease: "easeInOut" },
    });
  }, [hasPasswordAlert, passwordFieldControls]);

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
                <motion.div
                  animate={emailFieldControls}
                  className="relative"
                >
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    data-testid="login-email"
                    {...register("email")}
                    aria-invalid={hasEmailAlert}
                    className={cn(
                      "h-12 rounded-lg bg-background focus-visible:ring-2",
                      hasEmailAlert
                        ? "border-red-400/90 text-red-950 dark:text-red-50 shadow-[0_0_0_1px_rgba(248,113,113,0.55),0_0_24px_rgba(239,68,68,0.18)] focus-visible:ring-red-400/70"
                        : "border-neutral-200 dark:border-neutral-700",
                    )}
                  />
                </motion.div>
                {showEmailValidationError && errors.email && (
                  <p className="text-xs text-red-500">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Password
                </label>
                <motion.div
                  animate={passwordFieldControls}
                  className="relative"
                >
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    data-testid="login-password"
                    {...register("password")}
                    aria-invalid={hasPasswordAlert}
                    className={cn(
                      "h-12 pr-12 rounded-lg bg-background focus-visible:ring-2",
                      hasPasswordAlert
                        ? "border-red-400/90 text-red-950 dark:text-red-50 shadow-[0_0_0_1px_rgba(248,113,113,0.55),0_0_24px_rgba(239,68,68,0.18)] focus-visible:ring-red-400/70"
                        : "border-neutral-200 dark:border-neutral-700",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-1",
                      hasPasswordAlert
                        ? "text-red-400 hover:text-red-500"
                        : "text-muted-foreground hover:text-foreground",
                    )}
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
                </motion.div>
                {showPasswordValidationError && errors.password && (
                  <p className="text-xs text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="relative pt-2">
                <div className="flex justify-center">
                  <motion.button
                    type="submit"
                    data-testid="login-submit"
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
              disabled={!canResend}
              onClick={() => resendMutation.mutate()}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center mt-3 disabled:opacity-50"
            >
              {resendLabel}
            </button>
          </>
        )}

        <p className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs text-muted-foreground uppercase tracking-widest opacity-40">
          &copy; 2025 Rare Atelier. 
        </p>

      </div>
    </div>
  );
}
