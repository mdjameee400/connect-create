import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // same-origin paths only
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = sanitizeRedirect(search['redirect']);
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
  const goDest = () => { void navigate({ to: dest, replace: true } as never); };
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Redirect if already logged in, or after OAuth callback lands back on /auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) goDest();
    }).catch(() => {
      // Ignore initial session refresh failures
    });

    // Fires when OAuth provider redirects back with tokens in the URL hash
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goDest();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest]);

  // Helper: detect network/connection errors to show actionable guidance
  const getErrorMessage = (err: unknown): string => {
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      return "Cannot reach the server. Your Supabase project may be paused — go to supabase.com/dashboard to unpause it, then try again.";
    }
    if (err instanceof Error) return err.message;
    return "Something went wrong";
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // After email confirmation the user lands back here and the
            // onAuthStateChange listener above will redirect them automatically.
            emailRedirectTo: `${window.location.origin}/auth${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
            data: { full_name: name },
          },
        });
        if (error) throw error;

        // When email confirmation is disabled Supabase returns a session immediately.
        if (data.session) {
          toast.success("Account created — welcome to Connect Orbital!");
          goDest();
        } else {
          // Email confirmation is enabled — show a friendly holding screen.
          setConfirmationSent(true);
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goDest();
      }
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };


  // Native Supabase OAuth — works in local dev and production unlike Lovable proxy
  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Redirect back to /auth after Google consent; onAuthStateChange handles navigation
          redirectTo: `${window.location.origin}/auth${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
        },
      });
      if (error) throw error;
      // Browser is about to navigate to Google — keep loading state true
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 8000 });
      setLoading(false);
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
            We sent a confirmation link to <strong>{email}</strong>. Click it
            to activate your account and you'll be signed in automatically.
          </p>
          <Button variant="outline" onClick={() => setConfirmationSent(false)} className="w-full">
            Back to sign in
          </Button>
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

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
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
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? "Sign in" : "Create account"}
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
