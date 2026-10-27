import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Bot, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Role = "staff" | "student";
type Answer = {
  text: string;
  stats?: { label: string; value: number }[];
  complaints?: { id: number; consumerId: string; title: string; status: string; priority: string }[];
  suggestions: string[];
};
type Message = ({ id: number; from: "user"; text: string } | ({ id: number; from: "bot" } & Answer));

const FAQ: Record<Role, string[]> = {
  staff: [
    "How many complaints came today?",
    "How many complaints came yesterday?",
    "How many complaints are pending?",
    "Which complaints were updated today?",
    "How many serious complaints are open?",
  ],
  student: [
    "What is the status of my latest complaint?",
    "How many of my complaints are pending?",
    "Do I have new replies?",
    "How do I track a complaint?",
  ],
};

const QUICK: Record<Role, { label: string; question: string }[]> = {
  staff: [
    { label: "Today", question: "How many complaints came today?" },
    { label: "Yesterday", question: "How many complaints came yesterday?" },
    { label: "Pending", question: "How many complaints are pending?" },
    { label: "Updated", question: "Which complaints were updated today?" },
    { label: "Serious", question: "Show serious complaints" },
    { label: "Not serious", question: "Show not serious complaints" },
    { label: "Unread", question: "How many unread messages?" },
    { label: "Summary", question: "Show summary" },
  ],
  student: [
    { label: "Latest", question: "What is the status of my latest complaint?" },
    { label: "Pending", question: "How many of my complaints are pending?" },
    { label: "Resolved", question: "How many of my complaints are resolved?" },
    { label: "Replies", question: "Do I have new replies?" },
    { label: "Summary", question: "Show summary" },
  ],
};

const statusTone: Record<string, string> = {
  Pending: "bg-[#fff4e6] text-[#ba6915]",
  "In Progress": "bg-[#e9f7ff] text-[#1684b5]",
  Resolved: "bg-[#eafaf1] text-[#168052]",
  Withdrawn: "bg-[#fff0f2] text-[#bb3043]",
};

const storageKey = (userId: number | undefined) => `ccms-assistant-${userId ?? "anon"}`;

function loadMessages(userId: number | undefined): Message[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export default function AssistantWidget({ role, userName, userId }: { role: Role; userName?: string | null; userId?: number }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(userId));
  const nextId = useRef(messages.reduce((max, m) => Math.max(max, m.id), 0) + 1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstName = (userName ?? "").split(/\s+/)[0] || "there";

  const ask = trpc.assistant.ask.useMutation({
    onSuccess: answer => setMessages(prev => [...prev, { id: nextId.current++, from: "bot", ...answer }]),
    onError: () => setMessages(prev => [...prev, { id: nextId.current++, from: "bot", text: "Sorry, I couldn't get that answer just now. Please try again in a moment.", suggestions: [] }]),
  });

  // Keep the conversation across page changes and reloads in this browser tab only.
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage blocked: the chat still works, it just won't survive a reload */
    }
  }, [messages, userId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // A fresh chat starts at the greeting; once there is a conversation, follow the newest message.
    el.scrollTop = messages.some(m => m.from === "user") ? el.scrollHeight : 0;
  }, [messages.length, ask.isPending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    setMessages(prev => [...prev, { id: nextId.current++, from: "user", text }]);
    setInput("");
    ask.mutate({ question: text, tzOffsetMinutes: new Date().getTimezoneOffset() });
  };

  const lastBot = [...messages].reverse().find(m => m.from === "bot");
  const hasConversation = messages.some(m => m.from === "user");
  const complaintHref = (id: number) => (role === "staff" ? `/staff/complaints/${id}` : `/workspace/complaints/${id}`);

  return (
    <>
      {open && (
        <div role="dialog" aria-label="Complaint assistant"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[70] flex h-[640px] max-h-[calc(100dvh-7rem)] w-[400px] max-w-[calc(100vw-1.5rem)] sm:bottom-24 flex-col overflow-hidden rounded-3xl border border-[#dbe4f1] bg-white shadow-[0_24px_70px_rgba(6,27,86,.35)] sm:right-6">
          <header className="flex items-center gap-3 bg-gradient-to-r from-[#0b2a73] to-[#174cb8] px-5 py-4 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Bot className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold leading-tight">Complaint Assistant</p>
              <p className="text-[11px] text-white/70">{role === "staff" ? "Counts, pending, serious, unread…" : "Your complaints and replies"}</p>
            </div>
            <button type="button" onClick={() => { setMessages([]); try { sessionStorage.removeItem(storageKey(userId)); } catch { /* ignore */ } }} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Clear conversation" title="Clear conversation"><RotateCcw className="h-4 w-4" /></button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close assistant"><X className="h-4 w-4" /></button>
          </header>

          <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto bg-[#f9fbfe] px-4 py-4" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-[#eef3fb] px-4 py-3 text-[13px] leading-5 text-[#18366f]">
              <p>Hi {firstName} 👋</p>
              <p className="mt-1">{role === "staff" ? "I'm your complaint assistant. Ask me how many complaints came today or yesterday, what is pending, serious or updated, and what needs a reply." : "I'm your complaint assistant. Ask me about the status of your complaints or any new replies from staff."}</p>
            </div>

            {!hasConversation && (
              <>
                <div>
                  <p className="mb-2 text-[13px] font-extrabold text-[#18366f]">Frequently Asked</p>
                  <div className="flex flex-col items-start gap-2">
                    {FAQ[role].map(q => (
                      <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-[#cbd8ed] bg-white px-3.5 py-2 text-left text-[12px] text-[#31588f] transition hover:border-[#174cb8] hover:bg-[#f3f7fd]">{q}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-extrabold text-[#18366f]">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK[role].map(a => (
                      <button key={a.label} type="button" onClick={() => send(a.question)} className="rounded-full bg-[#e4edff] px-3.5 py-2 text-[12px] font-bold text-[#174cb8] transition hover:bg-[#d3e2ff]">{a.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {messages.map(m =>
              m.from === "user" ? (
                <div key={m.id} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#174cb8] px-4 py-2.5 text-[13px] text-white">{m.text}</p></div>
              ) : (
                <div key={m.id} className="max-w-[94%] space-y-2.5">
                  <div className="rounded-2xl rounded-tl-md bg-[#eef3fb] px-4 py-3 text-[13px] leading-5 text-[#18366f]"><p className="whitespace-pre-line">{m.text}</p></div>
                  {m.stats && (
                    <div className="grid grid-cols-2 gap-2">
                      {m.stats.map(s => (
                        <div key={s.label} className="rounded-xl border border-[#dbe4f1] bg-white px-3 py-2.5">
                          <p className="text-[20px] font-extrabold leading-none text-[#174cb8]">{s.value}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[.06em] text-[#8b9ab3]">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!m.complaints?.length && (
                    <ul className="divide-y divide-[#edf1f6] overflow-hidden rounded-xl border border-[#dbe4f1] bg-white">
                      {m.complaints.map(c => (
                        <li key={c.id}>
                          <Link href={complaintHref(c.id)} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 transition hover:bg-[#f7faff]">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-bold text-[#18366f]">{c.title}</p>
                              <p className="mt-0.5 font-mono text-[10px] text-[#8b9ab3]">{c.consumerId} · {c.priority}</p>
                            </div>
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", statusTone[c.status] ?? "bg-slate-100 text-slate-600")}>{c.status}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#b0bfd4]" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m === lastBot && !ask.isPending && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {m.suggestions.map(s => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-[#cbd8ed] bg-white px-3 py-1.5 text-[11px] text-[#31588f] transition hover:border-[#174cb8]">{s}</button>)}
                    </div>
                  )}
                </div>
              ),
            )}

            {ask.isPending && (
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-[#eef3fb] px-4 py-3" aria-label="Assistant is typing">
                {[0, 150, 300].map(delay => <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-[#7f9bd8]" style={{ animationDelay: `${delay}ms` }} />)}
              </div>
            )}
          </div>

          {hasConversation && (
            <div className="flex gap-2 overflow-x-auto border-t border-[#edf1f6] bg-white px-4 py-2.5">
              {QUICK[role].map(a => <button key={a.label} type="button" onClick={() => send(a.question)} disabled={ask.isPending} className="shrink-0 rounded-full bg-[#e4edff] px-3 py-1.5 text-[11px] font-bold text-[#174cb8] transition hover:bg-[#d3e2ff] disabled:opacity-50">{a.label}</button>)}
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); send(input); }} className="border-t border-[#edf1f6] bg-white p-3">
            <div className="flex items-center gap-2 rounded-full bg-[#f1f5fc] py-1.5 pl-4 pr-1.5">
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value.slice(0, 300))} placeholder={role === "staff" ? "Ask about complaints…" : "Ask about your complaints…"} aria-label="Ask the assistant" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#18366f] outline-none placeholder:text-[#8b9ab3]" />
              <button type="submit" disabled={!input.trim() || ask.isPending} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#174cb8] text-white transition hover:bg-[#123d9a] disabled:bg-[#b8c6e0]" aria-label="Send question">
                {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#9aabc4]">CCMS Assistant · answers come from live complaint data</p>
          </form>
        </div>
      )}

      <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? "Close complaint assistant" : "Open complaint assistant"} aria-expanded={open}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[70] flex h-12 w-12 items-center justify-center rounded-full sm:bottom-5 sm:right-6 sm:h-[60px] sm:w-[60px] bg-gradient-to-br from-[#2f6bdf] to-[#123d9a] text-white shadow-[0_12px_32px_rgba(23,76,184,.45)] transition hover:scale-105 sm:right-6">
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  );
}
