import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are the Orbital Connect assistant, a concise in-product helper.

Orbital Connect is a workspace that combines async screen recording with live video meetings.
Facts you may rely on:
- Recorder (Dashboard): records full screen, a window or a browser tab, with mic and optional
  system audio. Chunks upload to secure cloud storage while recording, so a crashed tab does not
  lose the take. A share link exists as soon as recording starts.
- Library: every recording for you and your workspace, with status (recording, uploading, ready,
  failed). Interrupted recordings can be finalized from here. Share pages live at /v/<id>.
- Meetings: scheduled from Dashboard or Calendar; each has a join link at /m/<slug>. Peer-to-peer
  audio/video with mic and camera toggles, in-meeting chat, a shared whiteboard, and host-side
  meeting recording that lands in the Library. Only signed-in members of the host's workspace can
  join — sharing the link outside the workspace does not grant access.
- Teams: everyone gets a workspace; owners invite teammates with an invite link from Settings.
- Calendar: upcoming and past meetings. Settings: workspace name, members, invites.
- Sign-in: email/password or Google.

Troubleshooting hints: camera/mic need browser permission (check the address-bar icon); a blocked
camera shows an avatar tile instead of video; the whiteboard and chat need a joined meeting;
recordings marked failed can be retried or finalized from the Library.

Rules: answer only questions about Orbital Connect and how to use it. Politely decline anything
off-topic. Be brief (under 120 words unless asked for detail), use plain text, and point to the
right page by name (Dashboard, Library, Calendar, Settings) when useful. Never invent features.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: Msg[] };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        if (!messages.length) return new Response("Messages are required", { status: 400 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-5.6-sol",
            instructions: SYSTEM,
            input: messages.map((m) => ({
              role: m.role,
              content: [
                {
                  type: m.role === "assistant" ? "output_text" : "input_text",
                  text: String(m.content ?? ""),
                },
              ],
            })),
            stream: true,
            reasoning: { effort: "low", summary: "auto" },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
          return new Response(
            status === 429
              ? "The assistant is busy right now — please try again in a moment."
              : status === 402
                ? "The assistant is out of credits. Please add credits to keep it running."
                : text || "The assistant could not respond.",
            { status },
          );
        }

        // Re-emit only the answer text as a plain text stream.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const reader = upstream.body.getReader();
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const event = JSON.parse(data) as { type?: string; delta?: string };
                if (event.type === "response.output_text.delta" && event.delta) {
                  controller.enqueue(encoder.encode(event.delta));
                }
              } catch {
                /* partial event */
              }
            }
          },
          cancel(reason) {
            return reader.cancel(reason);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
