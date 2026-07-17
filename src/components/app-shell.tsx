import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, PlaySquare, Calendar, Settings, Phone, HelpCircle, LogOut, Search, Bell, Video, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { pingPresence, makeSlug, useCurrentTeam } from "@/lib/team";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/library", label: "Library", icon: PlaySquare },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: team } = useCurrentTeam();
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string | null }>({
    name: "You", email: "", avatar: null,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: p } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", data.user.id).maybeSingle();
        setProfile({
          name: p?.display_name ?? data.user.email?.split("@")[0] ?? "You",
          email: data.user.email ?? "",
          avatar: p?.avatar_url ?? null,
        });
      }
    })();
  }, []);

  // Presence: ping on mount and every 2 minutes
  useEffect(() => {
    pingPresence();
    const t = setInterval(pingPresence, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const quickCall = useMutation({
    mutationFn: async () => {
      if (!team) throw new Error("No team");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = makeSlug();
        const { data, error } = await supabase.from("meetings").insert({
          team_id: team.id,
          created_by: userData.user.id,
          title: "Quick call",
          starts_at: new Date().toISOString(),
          duration_minutes: 30,
          room_slug: slug,
        }).select("room_slug").single();
        if (!error && data) return data;
        if (error && !error.message.includes("room_slug")) throw error;
      }
      throw new Error("Could not create call");
    },
    onSuccess: async (m) => {
      const url = `${window.location.origin}/m/${m.room_slug}`;
      try { await navigator.clipboard.writeText(url); toast.success("Join link copied", { description: url }); }
      catch { toast.success("Call created"); }
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/m/$slug", params: { slug: m.room_slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const initial = (profile.name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-secondary/40">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b">
          <div className="w-9 h-9 rounded-lg bg-brand text-brand-foreground grid place-items-center">
            <Video className="w-4.5 h-4.5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">Orbital Connect</div>
            <div className="text-[11px] text-muted-foreground">Productivity Hub</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-brand-soft text-brand" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 space-y-2">
          <Button
            className="w-full gap-2"
            onClick={() => quickCall.mutate()}
            disabled={quickCall.isPending || !team}
          >
            {quickCall.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            Quick Call
          </Button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-secondary"
            onClick={() => toast.info("Help center — coming soon")}
          >
            <HelpCircle className="w-4 h-4" /> Help
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-secondary"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b bg-card flex items-center gap-4 px-6">
          <div className="flex-1 max-w-2xl relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search recordings, meetings, teammates…" className="pl-9 bg-secondary/60 border-transparent" />
          </div>
          <button className="w-9 h-9 rounded-full hover:bg-secondary grid place-items-center text-muted-foreground">
            <Bell className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-secondary grid place-items-center text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
          </button>
          <Avatar className="w-9 h-9">
            {profile.avatar && <AvatarImage src={profile.avatar} />}
            <AvatarFallback className="bg-brand text-brand-foreground text-sm">{initial}</AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
