import { createFileRoute } from "@tanstack/react-router";
import { Recorder } from "@/components/recorder";
import { MeetPanel } from "@/components/meet-panel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 max-w-[1400px]">
      <Recorder />
      <MeetPanel />
    </div>
  );
}
