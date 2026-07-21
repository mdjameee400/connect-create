import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Video,
  Play,
  Share2,
  Users,
  Calendar,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  Circle,
  Radio,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Orbital Connect — Async recording meets live video" },
      {
        name: "description",
        content:
          "Record your screen, share instant links, and hop into live meetings with your team — all in one workspace.",
      },
      { property: "og:title", content: "Orbital Connect — Async recording meets live video" },
      {
        property: "og:description",
        content:
          "One workspace for screen recordings, share links, live meetings, and team collaboration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const primaryCta = signedIn
    ? { label: "Go to dashboard", to: "/dashboard" as const }
    : { label: "Get started free", to: "/auth" as const };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-7xl mx-auto flex items-center px-6 h-16">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-semibold tracking-tight">Orbital Connect</span>
          </Link>
          <nav className="ml-8 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/dashboard">Open dashboard <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 10%, color-mix(in oklab, var(--brand) 25%, transparent) 0%, transparent 60%), radial-gradient(50% 50% at 90% 20%, color-mix(in oklab, var(--accent-blue) 22%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-medium bg-brand-soft text-brand px-3 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> Async + live video, one workspace
            </span>
            <h1 className="mt-5 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Record it. Share it.<br />
              <span className="text-brand">Meet about it.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Orbital Connect is the calmer way for teams to communicate. Capture a screen recording,
              drop a share link into any chat, and jump on a live call — without juggling four tools.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-1.5 h-12 px-5">
                <Link to={primaryCta.to}>
                  {primaryCta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-5 gap-1.5">
                <a href="#how"><Play className="w-4 h-4" /> See how it works</a>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-brand" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-brand" /> Instant share links</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-brand" /> Team-ready</span>
            </div>
          </div>

          {/* Hero visual */}
          <HeroMock />
        </div>
      </section>

      {/* Logos / trust strip */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4 text-xs uppercase tracking-widest text-muted-foreground">
          <span>Trusted by fast-moving teams</span>
          <div className="flex items-center gap-8 opacity-70">
            <span className="font-semibold">Nova Labs</span>
            <span className="font-semibold">Fieldwork</span>
            <span className="font-semibold">Kadenza</span>
            <span className="font-semibold">Northline</span>
            <span className="font-semibold">Shorelight</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-brand text-sm font-medium">Everything you need</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Async recordings, live meetings, one calm hub.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop stitching together Loom, Zoom and Google Calendar. Orbital gives your team every
            format of video communication under a single roof.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Video className="w-5 h-5" />}
            title="Instant screen recording"
            body="Capture your tab, window, or full screen with system audio. Share links generate the moment you press stop."
          />
          <FeatureCard
            icon={<Share2 className="w-5 h-5" />}
            title="Loom-style share pages"
            body="Every recording gets a beautiful public playback page with signed URLs — no downloads, no account required."
          />
          <FeatureCard
            icon={<Radio className="w-5 h-5" />}
            title="Live video meetings"
            body="Peer-to-peer WebRTC calls with mic, camera, and mute controls. Join from any browser via a short URL."
          />
          <FeatureCard
            icon={<Users className="w-5 h-5" />}
            title="Teammates & invites"
            body="Invite your team with a single link. Every recording is shared with the workspace automatically."
          />
          <FeatureCard
            icon={<Calendar className="w-5 h-5" />}
            title="Scheduled meetings"
            body="Plan meetings for later with a shareable calendar view. Instant meetings for right now."
          />
          <FeatureCard
            icon={<ShieldCheck className="w-5 h-5" />}
            title="Private by default"
            body="Signed playback URLs, row-level security, and Google or email sign-in. You own your data."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-secondary/40 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-brand text-sm font-medium">How it works</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
              From "I need to explain this" to "here's the link" in 30 seconds.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Hit record"
              body="Pick a screen or window and start capturing. Your camera and mic are optional."
              icon={<Circle className="w-4 h-4 fill-brand text-brand" />}
            />
            <Step
              n={2}
              title="Get a share link"
              body="The moment you stop, a public playback link is copied to your clipboard. Ready to paste anywhere."
              icon={<Share2 className="w-4 h-4 text-brand" />}
            />
            <Step
              n={3}
              title="Follow up live"
              body="Turn any recording into a real conversation with an instant or scheduled meeting."
              icon={<Radio className="w-4 h-4 text-brand" />}
            />
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div
          className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--brand) 92%, black 5%), color-mix(in oklab, var(--accent-blue) 70%, var(--brand) 20%))",
          }}
        >
          <div className="relative z-10 max-w-2xl text-white">
            <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Bring your team into orbit.
            </h3>
            <p className="mt-3 text-white/85 text-lg">
              Free while you're getting started. Sign up in seconds — no card, no setup calls.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="h-12 px-5 gap-1.5">
                <Link to={primaryCta.to}>
                  {primaryCta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-5 bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#features">Explore features</a>
              </Button>
            </div>
          </div>
          <div
            aria-hidden
            className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
          />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-brand text-sm font-medium">Simple pricing</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Free to try. Priced when you're ready.
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <PricingCard
            name="Starter"
            price="Free"
            tagline="For solo creators kicking the tires."
            features={["Unlimited recordings", "Public share links", "1 teammate", "Community support"]}
            cta={{ label: "Start free", to: primaryCta.to }}
          />
          <PricingCard
            name="Team"
            price="$12"
            per="per user / month"
            highlight
            tagline="For teams that live in video."
            features={[
              "Everything in Starter",
              "Unlimited teammates",
              "Scheduled meetings",
              "Team library & analytics",
              "Priority support",
            ]}
            cta={{ label: "Start 14-day trial", to: primaryCta.to }}
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-secondary/40 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center">Common questions</h2>
          <div className="mt-10 space-y-4">
            <Faq q="Do viewers need an account to watch a recording?">
              No. Every recording gets a public playback page with a signed URL. Anyone with the link can watch.
            </Faq>
            <Faq q="How do live meetings work?">
              Meetings use peer-to-peer WebRTC with your browser's camera and microphone. You get a short join URL to share.
            </Faq>
            <Faq q="Can I invite my team?">
              Yes — one team is created for you on signup. Generate an invite link from the dashboard and your teammates join instantly.
            </Faq>
            <Faq q="What happens to my data?">
              Recordings are stored privately with row-level security. Only your team and people with a share link can access them.
            </Faq>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand grid place-items-center">
              <Video className="w-3 h-3 text-brand-foreground" />
            </div>
            <span>© {new Date().getFullYear()} Orbital Connect</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] blur-2xl opacity-40"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--accent-blue))" }}
      />
      <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-secondary/70 border-b border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-brand/70" />
          <span className="ml-3 text-xs text-muted-foreground">orbital.app/dashboard</span>
        </div>
        <div className="p-5 grid grid-cols-5 gap-4">
          <aside className="col-span-1 space-y-2 text-xs">
            <div className="h-7 rounded-md bg-brand-soft text-brand grid place-items-center font-medium">Dashboard</div>
            <div className="h-7 rounded-md bg-secondary/60" />
            <div className="h-7 rounded-md bg-secondary/60" />
            <div className="h-7 rounded-md bg-secondary/60" />
          </aside>
          <div className="col-span-4 space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-brand to-accent-blue p-4 text-white">
              <div className="flex items-center gap-2 text-xs opacity-90"><Circle className="w-3 h-3 fill-white" /> Recording</div>
              <div className="mt-2 text-lg font-medium">Design review — Homepage V4</div>
              <div className="mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full w-2/3 bg-white/80" />
              </div>
              <div className="mt-2 flex justify-between text-[10px] opacity-80"><span>02:41</span><span>04:02</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Library</div>
                <div className="mt-1 text-sm font-medium">28 recordings</div>
                <div className="mt-2 flex gap-1">
                  <div className="h-8 w-8 rounded bg-secondary" />
                  <div className="h-8 w-8 rounded bg-secondary" />
                  <div className="h-8 w-8 rounded bg-secondary" />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Live now</div>
                <div className="mt-1 text-sm font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse" /> Standup · 3 in room
                </div>
                <div className="mt-2 flex -space-x-1.5">
                  <div className="h-6 w-6 rounded-full bg-brand" />
                  <div className="h-6 w-6 rounded-full bg-accent-blue" />
                  <div className="h-6 w-6 rounded-full bg-muted-foreground/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:border-brand/40 transition-all">
      <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center">{icon}</div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body, icon }: { n: number; title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-full bg-brand text-brand-foreground grid place-items-center font-semibold text-sm">{n}</div>
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function PricingCard({
  name, price, per, tagline, features, cta, highlight,
}: {
  name: string;
  price: string;
  per?: string;
  tagline: string;
  features: string[];
  cta: { label: string; to: "/auth" | "/dashboard" };
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-8 ${
        highlight ? "border-brand bg-gradient-to-br from-brand-soft/60 to-card shadow-lg" : "border-border bg-card"
      }`}
    >
      {highlight && (
        <span className="inline-flex text-[10px] font-semibold tracking-widest uppercase bg-brand text-brand-foreground px-2 py-1 rounded-full">
          <Zap className="w-3 h-3 mr-1" /> Most popular
        </span>
      )}
      <h3 className="mt-3 text-xl font-semibold">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {per && <span className="text-sm text-muted-foreground">{per}</span>}
      </div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" /> {f}
          </li>
        ))}
      </ul>
      <Button asChild className="w-full mt-8" variant={highlight ? "default" : "outline"}>
        <Link to={cta.to}>{cta.label}</Link>
      </Button>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-card px-5 py-4 open:shadow-sm">
      <summary className="flex items-center justify-between cursor-pointer list-none font-medium">
        {q}
        <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
    </details>
  );
}
