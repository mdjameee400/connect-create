import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser, auth } from "@/lib/firebase";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      // Check current synchronous Firebase user first
      let user = auth.currentUser;
      if (!user) {
        // Wait for initial Firebase auth state to resolve
        user = await getCurrentUser();
      }

      if (!user) {
        throw redirect({
          to: "/auth",
          search: { redirect: location.pathname },
        });
      }
      return { user };
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) {
        throw err;
      }
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname },
      });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
