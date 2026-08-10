import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Play,
  Share2,
  Users,
  Calendar,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  Video,
  Lock,
  Mic,
  MonitorPlay,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Orbital Connect — Record. Share. Meet." },
      {
        name: "description",
        content:
          "One black-and-white workspace for screen recordings, instant share links, and private live meetings with your team.",
      },
      { property: "og:title", content: "Orbital Connect — Record. Share. Meet." },
      {
        property: "og:description",
        content:
          "Screen recordings, instant share links, and private team meetings in a single calm workspace.",
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
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl h-16 px-5 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold tracking-tight">Orbital Connect</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 ml-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!signedIn && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link to={primaryCta.to}>{primaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative border-b">
        <div className="absolute inset-0 hatch-soft pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
            Async recording + live meetings, one workspace
          </span>

          <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-[-0.04em] leading-[0.95] text-balance">
            Record. Share.
            <br />
            <span className="relative inline-block">
              Meet.
              <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-foreground" />
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
            Capture your screen in a click, send a link that plays anywhere, and jump
            into a private call with your team when it's faster to just talk.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="gap-2 h-12 px-6" asChild>
              <Link to={primaryCta.to}>
                {primaryCta.label} <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6" asChild>
              <SmoothLink href="#how">See how it works</SmoothLink>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for individuals · No credit card · Works in your browser
          </p>

          {/* Product mock */}
          <div className="relative mt-16">
            <div className="mx-auto max-w-4xl rounded-2xl border bg-card shadow-[0_24px_70px_-30px_rgba(0,0,0,0.45)] overflow-hidden text-left">
              <div className="h-10 border-b flex items-center gap-2 px-4">
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="mx-auto text-[11px] text-muted-foreground">
                  orbital.connect / dashboard
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr]">
                <aside className="hidden sm:block border-r p-4 space-y-1">
                  {[
                    { icon: MonitorPlay, label: "Record" },
                    { icon: Play, label: "Library" },
                    { icon: Calendar, label: "Calendar" },
                    { icon: Users, label: "Team" },
                  ].map((i, idx) => (
                    <div
                      key={i.label}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm ${
                        idx === 0 ? "bg-secondary font-medium" : "text-muted-foreground"
                      }`}
                    >
                      <i.icon className="w-4 h-4" /> {i.label}
                    </div>
                  ))}
                </aside>
                <div className="p-5">
                  <div className="rounded-xl border hatch aspect-[16/8] grid place-items-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-foreground text-background grid place-items-center">
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="text-xs text-muted-foreground">Start recording</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {["Sprint recap", "Design review", "Bug walkthrough"].map((t) => (
                      <div key={t} className="rounded-lg border p-3">
                        <div className="h-10 rounded-md hatch-soft border mb-2" />
                        <p className="text-xs font-medium truncate">{t}</p>
                        <p className="text-[10px] text-muted-foreground">2 min · shared</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span>Product teams</span>
          <span>Design studios</span>
          <span>Remote startups</span>
          <span>Support teams</span>
          <span>Educators</span>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Features</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Everything you need to explain something — without a meeting invite.
            </h2>
          </div>

          <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 border rounded-2xl overflow-hidden">
            {[
              {
                icon: MonitorPlay,
                title: "One-click screen recording",
                body: "Capture your screen and mic straight from the browser. No install, no setup, no plugin.",
              },
              {
                icon: Share2,
                title: "Instant share links",
                body: "The link is ready the moment you stop recording — uploading finishes quietly in the background.",
              },
              {
                icon: Video,
                title: "Private live meetings",
                body: "Peer-to-peer video and audio for your workspace. Links only work for people on your team.",
              },
              {
                icon: Calendar,
                title: "Scheduling built in",
                body: "Book a meeting, get a room link, and see the whole week on a clean calendar.",
              },
              {
                icon: Users,
                title: "Shared team library",
                body: "Every recording lands in one library your teammates can search and watch.",
              },
              {
                icon: ShieldCheck,
                title: "Access you control",
                body: "Workspace-scoped permissions on recordings and rooms. Invite in, revoke out.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card p-7 hover:bg-secondary/60 transition-colors">
                <f.icon className="w-5 h-5" />
                <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-20 space-y-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">How it works</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Three steps, start to shared.
            </h2>
          </div>

          {[
            {
              n: "01",
              title: "Hit record",
              body: "Pick a tab, a window, or your whole screen. Mic on if you want to narrate — everything is captured locally first, so it never lags.",
              icon: Mic,
            },
            {
              n: "02",
              title: "Send the link",
              body: "Stop recording and the share link is already on your clipboard. Anyone you send it to gets a clean playback page.",
              icon: Share2,
            },
            {
              n: "03",
              title: "Go live when it's faster",
              body: "Some things need a conversation. Schedule a room or start one now — only your workspace can get in.",
              icon: Lock,
            },
          ].map((s, i) => (
            <div
              key={s.n}
              className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <span className="text-xs font-mono text-muted-foreground">{s.n}</span>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">{s.body}</p>
              </div>
              <div className="rounded-2xl border hatch aspect-[16/10] grid place-items-center bg-card">
                <div className="w-16 h-16 rounded-2xl bg-foreground text-background grid place-items-center">
                  <s.icon className="w-7 h-7" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Pricing</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Simple, like the rest of it.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "$0",
                note: "for individuals",
                features: ["Unlimited recordings", "5-minute clips", "Share links", "1 workspace"],
                cta: "Start free",
                highlight: false,
              },
              {
                name: "Team",
                price: "$12",
                note: "per user / month",
                features: [
                  "Unlimited length",
                  "Private live meetings",
                  "Shared team library",
                  "Scheduling + calendar",
                ],
                cta: "Start free trial",
                highlight: true,
              },
              {
                name: "Business",
                price: "Custom",
                note: "for larger orgs",
                features: ["SSO & audit logs", "Retention controls", "Priority support", "Onboarding"],
                cta: "Talk to us",
                highlight: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-7 flex flex-col ${
                  p.highlight ? "bg-ink text-ink-foreground border-foreground" : "bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold tracking-tight">{p.name}</h3>
                  {p.highlight && (
                    <span className="text-[10px] uppercase tracking-widest rounded-full border border-current px-2 py-0.5">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mt-5 flex items-end gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                  <span className={`text-xs mb-1.5 ${p.highlight ? "opacity-70" : "text-muted-foreground"}`}>
                    {p.note}
                  </span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className={p.highlight ? "opacity-90" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-7 w-full"
                  variant={p.highlight ? "secondary" : "outline"}
                  asChild
                >
                  <Link to={primaryCta.to}>{p.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="border-b">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">
            Questions, answered.
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {[
              {
                q: "Can anyone with the meeting link join?",
                a: "No. Meeting links only work for signed-in members of the host's workspace. Everyone else sees a locked screen — invite them to the workspace first.",
              },
              {
                q: "Do I need to install anything?",
                a: "No. Recording and calls both run in the browser using standard web APIs. Chrome, Edge, and recent Safari all work.",
              },
              {
                q: "How long does uploading take?",
                a: "Your share link is generated the second you stop recording. The upload continues in the background and the page updates itself when it's ready.",
              },
              {
                q: "Who can see my recordings?",
                a: "By default your workspace can. Share links can be sent to people outside the team when you want an external viewer.",
              },
              {
                q: "Is there a free plan?",
                a: "Yes — unlimited recordings up to five minutes, forever, for individuals.",
              },
            ].map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────── */}
      <section className="relative bg-ink text-ink-foreground">
        <div className="absolute inset-0 hatch-invert pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
          <Zap className="w-6 h-6 mx-auto" />
          <h2 className="mt-5 text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-balance">
            Stop scheduling meetings that could be a link.
          </h2>
          <p className="mt-4 opacity-70">
            Set up your workspace in under a minute.
          </p>
          <Button size="lg" variant="secondary" className="mt-8 h-12 px-7 gap-2" asChild>
            <Link to={primaryCta.to}>
              {primaryCta.label} <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer>
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="text-sm font-semibold tracking-tight">Orbital Connect</span>
          </Link>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            © {new Date().getFullYear()} Orbital Connect. Record, share, meet.
          </p>
        </div>
      </footer>
    </div>
  );
}
