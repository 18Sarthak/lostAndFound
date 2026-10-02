import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { initSocket } from "@/lib/socket";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In | Campus Find" }] }),
  component: LoginPage,
});

type Step = "email" | "otp";

function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.auth.requestOtp(email.trim().toLowerCase());
      toast.success("Code sent! Check your email.");
      setStep("otp");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || (isNewUser && !name.trim())) return;
    setLoading(true);
    try {
      const res = await api.auth.verifyOtp(email, code.trim(), name.trim() || undefined);
      const token = res.data.accessToken;

      // Fetch user profile
      const me = await api.auth.me();
      setAuth(me.data, token);
      initSocket(token);

      toast.success(`Welcome${me.data.name ? `, ${me.data.name}` : ""}!`);
      void navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Invalid code";
      if (msg.toLowerCase().includes("name")) setIsNewUser(true);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground font-display">
            C
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {step === "email" ? "Sign in to Campus Find" : "Enter your code"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "email"
              ? "We'll send a one-time code to your email — no password needed."
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="email">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Send code
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {isNewUser && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="name">
                    Your name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First Last"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">First time signing in — tell us your name.</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="code">
                  6-digit code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm tracking-widest outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6 || (isNewUser && !name.trim())}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Verify & sign in
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setIsNewUser(false); }}
                className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Change email
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your contact info is never shared publicly.
        </p>
      </div>
    </div>
  );
}
