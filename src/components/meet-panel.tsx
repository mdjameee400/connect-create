import { Users, Copy, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const scheduled = [
  { date: "OCT", day: "24", title: "Product Sync: Q4 Goals", time: "10:00 AM - 11:00 AM", team: "PM Team", cta: null },
  { date: "OCT", day: "24", title: "Eng Weekly Deep-Dive", time: "02:30 PM - 03:30 PM", team: "Architecture", cta: "Join at 2:30" },
];

const teammates = [
  { name: "Alex Rivera", status: "Online", activity: "Coding", online: true },
  { name: "Sarah Chen", status: "Online", activity: "Reviewing PRs", online: true },
  { name: "Jordan Smith", status: "In a Meeting", activity: null, online: false },
  { name: "Elena Vance", status: "Online", activity: "Brainstorming", online: true },
];

export function MeetPanel() {
  const soon = () => toast.info("Live calling — coming soon");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-brand" />
        <h2 className="text-2xl font-semibold">Meet</h2>
      </div>

      <Card className="p-5 border-0" style={{ background: "linear-gradient(135deg, oklch(0.72 0.16 255), oklch(0.62 0.19 255))" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="text-white">
            <div className="font-semibold text-[15px]">Instant Meeting</div>
            <div className="text-white/85 text-sm">Start a room and invite others instantly.</div>
          </div>
          <Button size="sm" variant="secondary" className="bg-white text-slate-900 hover:bg-white/90 gap-1.5" onClick={soon}>
            <Copy className="w-3.5 h-3.5" /> Copy Join Link
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">SCHEDULED TODAY</div>
          <div className="text-xs text-muted-foreground">{scheduled.length} Meetings</div>
        </div>
        <div className="divide-y">
          {scheduled.map((m, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-11 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground">{m.date}</div>
                <div className="text-lg font-semibold leading-tight">{m.day}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground truncate">{m.time} · {m.team}</div>
              </div>
              {m.cta && (
                <Button size="sm" variant="outline" onClick={soon}>{m.cta}</Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b text-[11px] font-semibold tracking-wider text-muted-foreground">
          ACTIVE TEAMMATES
        </div>
        <div className="divide-y">
          {teammates.map((t) => (
            <div key={t.name} className="flex items-center gap-3 px-5 py-3">
              <div className="relative">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-secondary text-xs">{t.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${t.online ? "bg-brand" : "bg-amber-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  <span className={t.online ? "text-brand" : "text-amber-600"}>{t.status}</span>
                  {t.activity && <> · {t.activity}</>}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={soon}>
                <Video className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
