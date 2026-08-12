import jsPDF from "jspdf";
import type { ChatMessage } from "@/hooks/use-meeting-chat";

/** Export the meeting's chat transcript, shared notes and board snapshot. */
export function exportMeetingPdf(opts: {
  title: string;
  messages: ChatMessage[];
  notes: string;
  boardCanvas?: HTMLCanvasElement | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const line = (text: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, pageW - margin * 2) as string[];
    for (const w of wrapped) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(w, margin, y);
      y += size + 4;
    }
  };

  line(opts.title, 18, true);
  line(new Date().toLocaleString(), 9);
  y += 10;

  line("Chat transcript", 13, true);
  if (opts.messages.length === 0) line("No messages.", 10);
  for (const m of opts.messages) {
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    line(`[${time}] ${m.sender_id === "system" ? "" : `${m.sender_name}: `}${m.body}`, 10);
  }

  y += 12;
  line("Shared notes", 13, true);
  line(opts.notes.trim() || "No notes.", 10);

  if (opts.boardCanvas) {
    doc.addPage();
    y = margin;
    line("Whiteboard", 13, true);
    try {
      const img = opts.boardCanvas.toDataURL("image/png");
      const w = pageW - margin * 2;
      const h = (opts.boardCanvas.height / opts.boardCanvas.width) * w;
      doc.addImage(img, "PNG", margin, y, w, h);
    } catch {
      line("Board snapshot unavailable.", 10);
    }
  }

  const safe = opts.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safe || "meeting"}-notes.pdf`);
}
