import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: () => (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-semibold">Calendar</h1>
      </div>
      <Card className="p-12 text-center">
        <Calendar className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
        <p className="font-medium">Calendar integrations coming soon</p>
        <p className="text-sm text-muted-foreground mt-1">Google Calendar and Outlook sync are on the roadmap.</p>
      </Card>
    </div>
  ),
});
