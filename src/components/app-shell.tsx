import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, PlaySquare, Calendar, Settings, Phone, HelpCircle, LogOut, Search, Bell, Loader2, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logout, onAuthUserChanged } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { pingPresence, makeSlug, useCurrentTeam } from "@/lib/team";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

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
    const unsub = onAuthUserChanged(async (user) => {
      if (user) {
        let displayName = user.displayName;
        let avatarUrl = user.photoURL;

        // Try getting Supabase profile if exists
        try {
          const { data } = await supabase.auth.getUser();
          if (data.user) {
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", data.user.id)
              .maybeSingle();
            if (p?.display_name) displayName = p.display_name;
            if (p?.avatar_url) avatarUrl = p.avatar_url;
          }
        } catch {
          // ignore
        }

        setProfile({
          name: displayName ?? user.email?.split("@")[0] ?? "You",
          email: user.email ?? "",
          avatar: avatarUrl ?? null,
        });
      }
    });
    return () => unsub();
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
    await logout();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const initial = (profile.name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-secondary/40">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b">
          <Logo size={36} />
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">Connect Orbital</div>
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
          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-2">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Logo size={20} />
                  <span>Connect Orbital</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {nav.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} asChild>
                      <Link to={to} className="w-full flex items-center gap-2 cursor-pointer">
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={quickCall.isPending || !team}
                  onClick={() => quickCall.mutate()}
                  className="cursor-pointer flex items-center gap-2"
                >
                  {quickCall.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  <span>Quick Call</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Help center — coming soon")} className="cursor-pointer flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>Help</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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

          {/* User Profile Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none cursor-pointer rounded-full overflow-hidden hover:opacity-90 transition-opacity">
                <Avatar className="w-9 h-9">
                  {profile.avatar && <AvatarImage src={profile.avatar} />}
                  <AvatarFallback className="bg-brand text-brand-foreground text-sm">{initial}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{profile.email || "No email"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {nav.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem key={to} asChild>
                    <Link to={to} className="w-full flex items-center gap-2 cursor-pointer">
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

