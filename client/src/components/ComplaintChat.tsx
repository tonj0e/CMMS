import { useEffect, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { AlertCircle, Check, CheckCheck, Loader2, Lock, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { PROFANITY_MESSAGE, findProfanity, maskWord } from "@shared/profanity";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  complaintId: number;
  /** Which side is looking at the chat; decides the labels and who counts as "unread". */
  viewer: "student" | "staff";
  /** Withdrawn complaints are closed: the history stays readable but nothing new can be sent. */
  closed?: boolean;
  className?: string;
  /** Height of the scrolling message area. */
  messagesClassName?: string;
};

const MAX_LENGTH = 2000;

export default function ComplaintChat({ complaintId, viewer, closed = false, className, messagesClassName = "h-[340px]" }: Props) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const lastMarked = useRef(0);
  // "Read" means actually seen: the chat must be on screen (it can sit below the fold on the tracking page).
  const [onScreen, setOnScreen] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Poll so a reply appears without refreshing the page.
  const { data: messages, isLoading, error, refetch } = trpc.messages.list.useQuery({ complaintId }, { refetchInterval: 5000, retry: false });

  const refreshBadges = () => {
    void utils.messages.unreadByComplaint.invalidate();
    void utils.notifications.summary.invalidate();
    void utils.notifications.list.invalidate();
    void utils.staff.conversations.invalidate();
  };

  const markRead = trpc.messages.markRead.useMutation({ onSuccess: refreshBadges });
  const send = trpc.messages.send.useMutation({
    onSuccess: async () => {
      setDraft("");
      await utils.messages.list.invalidate({ complaintId });
      refreshBadges();
    },
    onError: err => toast.error(err.message),
  });

  // Anything from the other side that is still unread counts as read once it is on screen.
  useEffect(() => {
    if (!onScreen) return;
    const newestUnread = messages?.filter(m => !m.mine && !m.readAt).at(-1);
    if (newestUnread && newestUnread.id !== lastMarked.current) {
      lastMarked.current = newestUnread.id;
      markRead.mutate({ complaintId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, complaintId, onScreen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  const flagged = findProfanity(draft);
  const canSend = !closed && !send.isPending && draft.trim().length > 0 && flagged.length === 0;
  const otherLabel = viewer === "staff" ? "Student" : "Staff";

  const submit = () => {
    if (canSend) send.mutate({ complaintId, body: draft.trim() });
  };

  return (
    <section ref={rootRef} id="complaint-chat" className={cn("flex flex-col rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]", className)} aria-label="Conversation">
      <header className="flex items-center gap-2 border-b border-[#e5ebf3] px-5 py-3.5">
        <MessageSquareText className="h-4 w-4 text-[#2458c4]" />
        <p className="text-[12px] font-extrabold uppercase tracking-[.1em] text-[#7788a5]">Messages</p>
        <span className="ml-auto text-[10px] text-[#9aabc4]">{viewer === "staff" ? "Chatting with the student" : "Chatting with campus staff"}</span>
      </header>

      <div ref={scrollRef} className={cn("space-y-3 overflow-y-auto bg-[#f9fbfe] px-5 py-4", messagesClassName)} aria-live="polite">
        {isLoading && <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#3971d7]" /></div>}
        {error && (
          <div role="alert" className="rounded-xl border border-[#f1c9c9] bg-[#fff6f6] p-4 text-center text-[12px] text-[#a33a3a]">
            Could not load messages. <button type="button" onClick={() => refetch()} className="font-bold underline">Try again</button>
          </div>
        )}
        {!isLoading && !error && messages?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquareText className="h-8 w-8 text-[#c1d2f9]" />
            <p className="mt-2 text-[13px] font-extrabold text-[#18366f]">No messages yet</p>
            <p className="mt-1 max-w-[260px] text-[11px] text-[#8b9ab3]">
              {viewer === "staff" ? "Send the first message to ask the student for more details." : "Staff will reply here. You can also write to them first."}
            </p>
          </div>
        )}
        {messages?.map(m => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-5 shadow-sm", m.mine ? "rounded-br-md bg-[#174cb8] text-white" : "rounded-bl-md border border-[#dbe4f1] bg-white text-[#18366f]")}>
              <p className={cn("mb-0.5 text-[10px] font-extrabold uppercase tracking-[.08em]", m.mine ? "text-[#bcd2ff]" : "text-[#7788a5]")}>{m.mine ? "You" : otherLabel}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.mine ? "text-[#bcd2ff]" : "text-[#9aabc4]")}>
                {format(new Date(m.createdAt), isToday(new Date(m.createdAt)) ? "h:mm a" : "MMM d, h:mm a")}
                {m.mine && (m.readAt ? <CheckCheck className="h-3 w-3" aria-label="Seen" /> : <Check className="h-3 w-3" aria-label="Sent" />)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e5ebf3] p-4">
        {closed ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-[#f3f7fd] px-3 py-3 text-[11px] font-bold text-[#5d729a]"><Lock className="h-3.5 w-3.5" />This complaint is closed, so no new messages can be sent.</p>
        ) : (
          <>
            {flagged.length > 0 && (
              <p role="alert" className="mb-2 flex items-start gap-1.5 text-[11px] text-[#a33a3a]">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{PROFANITY_MESSAGE} <span className="text-[#c05a5a]">Found: {flagged.map(maskWord).join(", ")}</span></span>
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={viewer === "staff" ? "Reply to the student…" : "Write a message to staff…"}
                aria-label="Message"
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-[#d7e2f4] bg-white px-3 py-2.5 text-[12px] text-[#18366f] outline-none focus:border-[#3971d7] focus:ring-2 focus:ring-[#3971d7]/20"
              />
              <Button type="button" onClick={submit} disabled={!canSend} className="h-[52px] rounded-xl bg-[#174cb8] px-4 text-[12px] font-bold hover:bg-[#123d9a]" aria-label="Send message">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-[#9aabc4]">Enter to send · Shift+Enter for a new line · {draft.length}/{MAX_LENGTH}</p>
          </>
        )}
      </div>
    </section>
  );
}
