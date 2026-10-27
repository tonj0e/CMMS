import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { isToday, isYesterday } from "date-fns";
import { ArrowUpRight, Loader2, MessageSquareText, Search } from "lucide-react";
import { STATUS_TRANSITIONS, type ComplaintStatus } from "@shared/ccms";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ComplaintChat from "@/components/ComplaintChat";
import { EmptyCard, PriorityBadge, QueryError, SectionHeader, ShowMore, StatusBadge, timeAgo, usePaging } from "@/components/workspace-ui";

type DateFilter = "all" | "today" | "yesterday" | "pending" | "active";
type Tab = "needs" | "chats" | "all";

/** Staff chat inbox: headline counts on top, conversations on the left, the open chat on the right. */
export default function StaffMessages() {
  const utils = trpc.useUtils();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const stats = trpc.staff.stats.useQuery({ tzOffsetMinutes }, { refetchInterval: 15_000, retry: false });
  const conversations = trpc.staff.conversations.useQuery(undefined, { refetchInterval: 10_000, retry: false });
  const [filter, setFilter] = useState<DateFilter>("all");
  const [tab, setTab] = useState<Tab | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const all = conversations.data ?? [];
  const needsReply = useMemo(() => all.filter(c => c.unreadMessages > 0), [all]);
  const withChats = useMemo(() => all.filter(c => c.messageCount > 0), [all]);
  const unreadTotal = needsReply.reduce((sum, c) => sum + c.unreadMessages, 0);

  // First load: land on "Needs reply" when something is waiting, otherwise on the full list. After that the user decides.
  const activeTab: Tab = tab ?? (needsReply.length > 0 ? "needs" : "all");

  const visibleList = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const base = activeTab === "needs" ? needsReply : activeTab === "chats" ? withChats : all;
    return base.filter(c => {
      const matchesDate = filter === "all" ? true
        : filter === "today" ? isToday(new Date(c.createdAt))
        : filter === "yesterday" ? isYesterday(new Date(c.createdAt))
        : filter === "pending" ? c.status === "Pending"
        : c.status === "In Progress";
      return matchesDate && (!q || c.title.toLowerCase().includes(q) || c.consumerId.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
    });
  }, [all, needsReply, withChats, activeTab, filter, deferredSearch]);
  const { visible, remaining, showMore } = usePaging(visibleList, 25, `${activeTab}|${filter}|${deferredSearch}`);
  const selected = all.find(c => c.id === selectedId) ?? null;

  // On a phone the chat renders below the list, so bring it into view after a conversation is picked.
  const openConversation = (id: number) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const updateStatus = trpc.staff.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.staff.conversations.invalidate(), utils.staff.stats.invalidate(), utils.staff.list.invalidate(), utils.staff.summary.invalidate(), utils.messages.list.invalidate()]);
      toast.success("Status updated");
    },
    onError: err => toast.error(err.message),
  });

  const cards: { id: DateFilter; label: string; value: number; note: string; tone: string }[] = [
    { id: "today", label: "New today", value: stats.data?.today ?? 0, note: "Complaints filed today", tone: "text-[#2458c4]" },
    { id: "yesterday", label: "Yesterday", value: stats.data?.yesterday ?? 0, note: "Complaints filed yesterday", tone: "text-[#5d729a]" },
    { id: "pending", label: "Pending", value: stats.data?.pending ?? 0, note: "Waiting for staff", tone: "text-[#ba6915]" },
    { id: "active", label: "In progress", value: stats.data?.inProgress ?? 0, note: "Being worked on", tone: "text-[#1684b5]" },
  ];
  const tabs: { id: Tab; label: string; short: string; count: number }[] = [
    { id: "needs", label: "Needs reply", short: "To reply", count: needsReply.length },
    { id: "chats", label: "Conversations", short: "Chats", count: withChats.length },
    { id: "all", label: "All", short: "All", count: all.length },
  ];

  return (
    <>
      <SectionHeader eyebrow="Student conversations" title="Messages" description="See what came in today, read a student's message and reply. Pick a card to filter the list." />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5">
        {cards.map(card => (
          <button key={card.id} type="button" onClick={() => setFilter(filter === card.id ? "all" : card.id)} aria-pressed={filter === card.id}
            className={cn("rounded-[16px] border bg-white p-3.5 text-left shadow-[0_6px_24px_rgba(28,69,137,.055)] transition hover:border-[#9cb7e9] sm:p-4", filter === card.id ? "border-[#174cb8] ring-2 ring-[#174cb8]/20" : "border-[#dbe4f1]")}>
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8a9bb5]">{card.label}</p>
            <p className={cn("mt-1 text-[24px] font-extrabold leading-none sm:text-[28px]", card.tone)}>{card.value}</p>
            <p className="mt-1.5 text-[10px] text-[#9aabc4]">{card.note}</p>
          </button>
        ))}
        <button type="button" onClick={() => setTab("needs")} aria-pressed={activeTab === "needs"}
          className={cn("col-span-2 rounded-[16px] border bg-white p-3.5 text-left shadow-[0_6px_24px_rgba(28,69,137,.055)] transition hover:border-[#9cb7e9] sm:p-4 xl:col-span-1", unreadTotal > 0 ? "border-[#f2b9c2]" : "border-[#dbe4f1]")}>
          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8a9bb5]">Unread messages</p>
          <p className={cn("mt-1 text-[24px] font-extrabold leading-none sm:text-[28px]", unreadTotal > 0 ? "text-[#c2364a]" : "text-[#27a76c]")}>{unreadTotal}</p>
          <p className="mt-1.5 text-[10px] text-[#9aabc4]">{unreadTotal > 0 ? "Students waiting for a reply" : "All caught up"}</p>
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="min-w-0 rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="space-y-3 border-b border-[#e5ebf3] p-3">
            <div className="flex gap-1 rounded-lg bg-[#f2f5fa] p-1" role="tablist" aria-label="Conversation list">
              {tabs.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} onClick={() => setTab(t.id)}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-[11px] font-bold transition sm:py-1.5", activeTab === t.id ? "bg-white text-[#2458c4] shadow-sm" : "text-[#8293ad] hover:text-[#2458c4]")}>
                  <span className="whitespace-nowrap"><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></span>
                  <span className={cn("rounded-full px-1.5 text-[10px]", t.id === "needs" && t.count > 0 ? "bg-[#e5484d] text-white" : activeTab === t.id ? "bg-[#e4edff] text-[#2458c4]" : "bg-[#e5ebf3] text-[#8293ad]")}>{t.count}</span>
                </button>
              ))}
            </div>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aabc4]" /><Input className="h-9 border-[#e0e7f1] pl-9 text-[11px]" placeholder="Search tracking number, title or location" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search conversations" /></div>
            <p className="text-[10px] text-[#9aabc4]">{visibleList.length} {visibleList.length === 1 ? "complaint" : "complaints"}{filter !== "all" && <> · <button type="button" onClick={() => setFilter("all")} className="font-bold text-[#2458c4] hover:underline">clear card filter</button></>}</p>
          </div>
          <div className="max-h-[640px] divide-y divide-[#edf1f6] overflow-y-auto">
            {conversations.isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#3971d7]" /></div>}
            {conversations.error && <div className="p-4"><QueryError message={conversations.error.message} onRetry={() => conversations.refetch()} /></div>}
            {visible.map(c => (
              <button key={c.id} type="button" onClick={() => openConversation(c.id)} aria-pressed={selectedId === c.id}
                className={cn("flex w-full items-start gap-3 p-4 text-left transition hover:bg-[#f7faff]", selectedId === c.id && "bg-[#eef4ff]")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-bold text-[#18366f]">{c.title}</p>
                    {c.unreadMessages > 0 && <span className="shrink-0 rounded-full bg-[#e5484d] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white" aria-label={`${c.unreadMessages} unread`}>{c.unreadMessages} new</span>}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-[#8b9ab3]">{c.consumerId} · {timeAgo(c.lastMessage?.createdAt ?? c.createdAt)}</p>
                  <p className={cn("mt-1 truncate text-[11px]", c.unreadMessages > 0 ? "font-bold text-[#18366f]" : "text-[#71819c]")}>
                    {c.lastMessage ? `${c.lastMessage.from === "staff" ? "You" : "Student"}: ${c.lastMessage.body}` : "No messages yet"}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </button>
            ))}
            {!conversations.isLoading && !conversations.error && visibleList.length === 0 && (
              <div className="px-6 py-12 text-center text-[12px] text-[#8b9ab3]">
                {activeTab === "needs" ? "No student is waiting for a reply." : "Nothing matches this filter."}
                {activeTab !== "all" && <> <button type="button" onClick={() => setTab("all")} className="font-bold text-[#2458c4] hover:underline">See all complaints</button></>}
              </div>
            )}
          </div>
          <ShowMore remaining={remaining} onClick={showMore} noun="more" />
        </div>

        {selected ? (
          <div ref={detailRef} className="min-w-0 scroll-mt-24 space-y-4">
            <div className="rounded-[17px] border border-[#dbe4f1] bg-white p-5 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-extrabold text-[#0b255f]">{selected.title}</h3><StatusBadge status={selected.status} /><PriorityBadge priority={selected.priority} /></div>
                  <p className="mt-1 font-mono text-[11px] font-bold text-[#174cb8]">{selected.consumerId}</p>
                  <p className="mt-0.5 text-[11px] text-[#8b9ab3]">{selected.category} · {selected.location} · {selected.isAnonymous ? "Anonymous student" : selected.studentRef ? `Student ID ${selected.studentRef}` : "No Student ID on record"}</p>
                </div>
                <Link href={`/staff/complaints/${selected.id}`} className="tap-area flex items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">Full complaint <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap rounded-xl bg-[#f3f7fd] p-3 text-[12px] leading-5 text-[#3e5578]">{selected.description}</p>
              {STATUS_TRANSITIONS[selected.status].some(next => next !== "Withdrawn") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b9ab3]">Move to</span>
                  {STATUS_TRANSITIONS[selected.status].filter(next => next !== "Withdrawn").map((next: ComplaintStatus) => (
                    <Button key={next} type="button" variant="outline" size="sm" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ complaintId: selected.id, status: next })} className="h-8 rounded-lg border-[#cbd8ed] px-3 text-[11px] font-bold text-[#31588f]">{next}</Button>
                  ))}
                </div>
              )}
            </div>
            <ComplaintChat key={selected.id} complaintId={selected.id} viewer="staff" closed={selected.status === "Withdrawn"} messagesClassName="h-[300px]" />
          </div>
        ) : (
          <EmptyCard icon={<MessageSquareText className="h-10 w-10" />} title="Select a complaint to open the chat">
            {needsReply.length > 0 ? `${needsReply.length} ${needsReply.length === 1 ? "student is" : "students are"} waiting for a reply.` : "You will see what the student wrote, can change its status, and reply right here."}
          </EmptyCard>
        )}
      </div>
    </>
  );
}
