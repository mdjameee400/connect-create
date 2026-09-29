import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
};

export type TeamInvite = {
  id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
};

export type CurrentTeam = {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "member";
};

export async function fetchCurrentTeam(): Promise<CurrentTeam | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  try {
    const { data, error } = await supabase
      .from("team_members")
      .select("role, joined_at, teams!inner(id, name, owner_id)")
      .eq("user_id", userData.user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.teams) {
      const t = data.teams as unknown as { id: string; name: string; owner_id: string };
      return { id: t.id, name: t.name, owner_id: t.owner_id, role: data.role as "owner" | "member" };
    }
  } catch (e) {
    console.warn("[Team] Remote fetch error, falling back to personal workspace:", e);
  }

  // Fallback to personal workspace so Quick Call and team operations always work
  return {
    id: userData.user.id,
    name: "Personal Workspace",
    owner_id: userData.user.id,
    role: "owner",
  };
}

export function useCurrentTeam() {
  return useQuery({
    queryKey: ["current-team"],
    queryFn: fetchCurrentTeam,
    staleTime: 60_000,
  });
}

export async function fetchTeammates(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("user_id, role, joined_at")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });
  if (error || !data) return [];
  const ids = data.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, last_seen_at")
    .in("id", ids);
  const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return data.map((r) => {
    const p = profMap.get(r.user_id);
    return {
      user_id: r.user_id,
      role: r.role as "owner" | "member",
      joined_at: r.joined_at,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      last_seen_at: p?.last_seen_at ?? null,
    };
  });
}

export async function fetchPendingInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from("team_invites")
    .select("id, email, token, status, created_at")
    .eq("team_id", teamId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TeamInvite[];
}

export function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Bump last_seen_at for presence
export async function pingPresence() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userData.user.id);
  } catch {
    // Ignore presence errors when offline or unauthenticated in Supabase
  }
}

// Generate an 8-char url-safe slug
export function makeSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return s;
}
