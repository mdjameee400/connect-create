import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

async function ping() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    return Response.json(
      { status: "degraded", database: "unconfigured", timestamp: new Date().toISOString() },
      { status: 503, headers },
    );
  }

  const supabase = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const started = Date.now();
  // Lightweight keep-alive read: counts only, returns no rows and no user data.
  const { error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (error) {
    return Response.json(
      {
        status: "degraded",
        database: "error",
        latency_ms: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }

  return Response.json(
    {
      status: "ok",
      database: "reachable",
      latency_ms: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers },
  );
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => ping(),
      HEAD: async () => ping(),
      OPTIONS: async () => new Response(null, { status: 204, headers }),
    },
  },
});
