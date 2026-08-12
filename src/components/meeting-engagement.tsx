import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, X, Check, ArrowBigUp, Loader2 } from "lucide-react";

type Poll = {
  id: string;
  question: string;
  options: string[];
  closed: boolean;
  created_by: string;
  created_at: string;
};
type Vote = { poll_id: string; voter_id: string; option_index: number };

function useMe() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);
  return me;
}

/* ------------------------------- Polls -------------------------------- */

export function MeetingPolls({ meetingId }: { meetingId: string }) {
  const me = useMe();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const load = useCallback(async () => {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase
        .from("meeting_polls")
        .select("id, question, options, closed, created_by, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false }),
      supabase
        .from("meeting_poll_votes")
        .select("poll_id, voter_id, option_index")
        .eq("meeting_id", meetingId),
    ]);
    setPolls((p ?? []) as Poll[]);
    setVotes((v ?? []) as Vote[]);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`polls:${meetingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_polls", filter: `meeting_id=eq.${meetingId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_poll_votes", filter: `meeting_id=eq.${meetingId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, load]);

  const createPoll = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2 || !me) {
      toast.error("Add a question and at least two options");
      return;
    }
    const { error } = await supabase.from("meeting_polls").insert({
      meeting_id: meetingId,
      created_by: me,
      question: question.trim(),
      options: opts,
    });
    if (error) return toast.error(error.message);
    setQuestion("");
    setOptions(["", ""]);
    setCreating(false);
    void load();
  };

  const vote = async (poll: Poll, index: number) => {
    if (!me || poll.closed) return;
    const { error } = await supabase
      .from("meeting_poll_votes")
      .upsert(
        { poll_id: poll.id, meeting_id: meetingId, voter_id: me, option_index: index },
        { onConflict: "poll_id,voter_id" },
      );
    if (error) toast.error(error.message);
    else void load();
  };

  const setClosed = async (poll: Poll, closed: boolean) => {
    const { error } = await supabase.from("meeting_polls").update({ closed }).eq("id", poll.id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (loading)
    return (
      <div className="grid place-items-center h-full text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {creating ? (
        <div className="border rounded-lg p-3 space-y-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Poll question"
            aria-label="Poll question"
          />
          {options.map((o, i) => (
            <Input
              key={i}
              value={o}
              onChange={(e) =>
                setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
              }
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
            />
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOptions((p) => [...p, ""])}>
              Add option
            </Button>
            <Button size="sm" onClick={() => void createPoll()}>
              Launch
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" className="w-full gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="w-3.5 h-3.5" /> New poll
        </Button>
      )}

      {polls.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No polls yet. Ask the room a question.
        </p>
      )}

      {polls.map((poll) => {
        const pv = votes.filter((v) => v.poll_id === poll.id);
        const mine = pv.find((v) => v.voter_id === me);
        const total = pv.length || 1;
        return (
          <div key={poll.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <p className="text-sm font-medium flex-1">{poll.question}</p>
              {poll.created_by === me && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7"
                  aria-label={poll.closed ? "Reopen poll" : "Close poll"}
                  onClick={() => void setClosed(poll, !poll.closed)}
                >
                  {poll.closed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
            {poll.options.map((opt, i) => {
              const count = pv.filter((v) => v.option_index === i).length;
              const pct = Math.round((count / total) * 100);
              return (
                <button
                  key={i}
                  onClick={() => void vote(poll, i)}
                  disabled={poll.closed}
                  className={`w-full text-left relative border rounded-md px-2 py-1.5 overflow-hidden ${
                    mine?.option_index === i ? "border-foreground" : ""
                  } ${poll.closed ? "opacity-70" : "hover:bg-secondary"}`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-secondary"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <span className="relative flex justify-between text-xs">
                    <span>{opt}</span>
                    <span className="text-muted-foreground">
                      {count} · {pct}%
                    </span>
                  </span>
                </button>
              );
            })}
            {poll.closed && <p className="text-[11px] text-muted-foreground">Poll closed</p>}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Q&A -------------------------------- */

type Question = {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  answered: boolean;
  created_at: string;
};

export function MeetingQA({
  meetingId,
  displayName,
}: {
  meetingId: string;
  displayName: string;
}) {
  const me = useMe();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [votes, setVotes] = useState<{ question_id: string; voter_id: string }[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const [{ data: q }, { data: v }] = await Promise.all([
      supabase
        .from("meeting_questions")
        .select("id, body, author_id, author_name, answered, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("meeting_question_votes")
        .select("question_id, voter_id")
        .eq("meeting_id", meetingId),
    ]);
    setQuestions((q ?? []) as Question[]);
    setVotes(v ?? []);
  }, [meetingId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`qa:${meetingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_questions", filter: `meeting_id=eq.${meetingId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_question_votes", filter: `meeting_id=eq.${meetingId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, load]);

  const ask = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setText("");
    const { error } = await supabase.from("meeting_questions").insert({
      meeting_id: meetingId,
      author_id: me,
      author_name: displayName,
      body,
    });
    if (error) toast.error(error.message);
    else void load();
  };

  const toggleVote = async (id: string) => {
    if (!me) return;
    const mine = votes.some((v) => v.question_id === id && v.voter_id === me);
    const { error } = mine
      ? await supabase
          .from("meeting_question_votes")
          .delete()
          .eq("question_id", id)
          .eq("voter_id", me)
      : await supabase
          .from("meeting_question_votes")
          .insert({ question_id: id, meeting_id: meetingId, voter_id: me });
    if (error) toast.error(error.message);
    else void load();
  };

  const sorted = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    const av = votes.filter((v) => v.question_id === a.id).length;
    const bv = votes.filter((v) => v.question_id === b.id).length;
    return bv - av;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No questions yet — ask the first one.
          </p>
        )}
        {sorted.map((q) => {
          const count = votes.filter((v) => v.question_id === q.id).length;
          const mine = votes.some((v) => v.question_id === q.id && v.voter_id === me);
          return (
            <div
              key={q.id}
              className={`flex gap-2 border rounded-lg p-2 ${q.answered ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => void toggleVote(q.id)}
                aria-label="Upvote question"
                className={`shrink-0 w-9 rounded-md border grid place-items-center text-[11px] font-semibold ${
                  mine ? "bg-secondary border-foreground" : ""
                }`}
              >
                <ArrowBigUp className="w-3.5 h-3.5" />
                {count}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words">{q.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {q.author_name}
                  {q.answered && " · answered"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7 shrink-0"
                aria-label="Mark answered"
                onClick={() =>
                  void supabase
                    .from("meeting_questions")
                    .update({ answered: !q.answered })
                    .eq("id", q.id)
                    .then(() => load())
                }
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void ask();
            }
          }}
          placeholder="Ask a question"
          aria-label="Ask a question"
        />
        <Button size="sm" onClick={() => void ask()} disabled={!text.trim()}>
          Ask
        </Button>
      </div>
    </div>
  );
}
