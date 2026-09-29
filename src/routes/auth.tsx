import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import {
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  onAuthUserChanged,
  getFirebaseErrorMessage,
  auth,
} from "@/lib/firebase";

function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = sanitizeRedirect(search["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Connect Orbital" },
      { name: "description", content: "Sign in to Connect Orbital to record, share, and meet." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const dest = redirect ?? "/dashboard";
  const goDest = () => {
    void navigate({ to: dest, replace: true } as never);
  };

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      if (user) {
        // If user is already authenticated and verified (or signed in via Google)
        goDest();
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { verificationSent } = await registerWithEmail(email, password, name);
        if (verificationSent) {
          setConfirmationSent(true);
          toast.success("Verification link sent! Check your inbox.");
        } else {
          toast.success("Account created — welcome to Connect Orbital!");
          goDest();
        }
      } else {
        const user = await loginWithEmail(email, password);
        if (!user.emailVerified) {
          toast.info("Tip: Your email is not yet verified. Check your inbox for the verification email.");
        }
        toast.success("Signed in successfully!");
        goDest();
      }
    } catch (err) {
      toast.error(getFirebaseErrorMessage(err), { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google!");
      goDest();
    } catch (err) {
      // If redirecting (popup fallback), the page navigates away — no error needed
      if (err instanceof Error && err.message.includes("Redirecting")) {
        return;
      }
      toast.error(getFirebaseErrorMessage(err), { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await resendVerificationEmail(auth.currentUser);
      toast.success("Verification email resent! Please check your inbox and spam folder.");
    } catch (err) {
      toast.error(getFirebaseErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  // ── Email confirmation holding screen ─────────────────────────────────────
  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/40 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand grid place-items-center mx-auto mb-6">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Check your inbox</h1>
          <p className="text-muted-foreground mb-6">
            We sent a verification link to <strong>{email}</strong>. Click it to verify your account,
            then come back here to sign in.
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleResendVerification}
              disabled={resending}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${resending ? "animate-spin" : ""}`} />
              Resend verification email
            </Button>

            <Button
              variant="default"
              onClick={() => {
                setConfirmationSent(false);
                setMode("signin");
              }}
              className="w-full"
            >
              Continue to sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main auth form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={40} />
          <span className="font-semibold text-xl">Connect Orbital</span>
        </Link>

        <Card className="p-8">
          <h1 className="text-2xl font-semibold mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Sign in to record and meet with your team."
              : "Free forever for individuals."}
          </p>

          {/* Google OAuth via Firebase */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {mode === "signin" ? "New to Connect Orbital?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-brand font-medium hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
