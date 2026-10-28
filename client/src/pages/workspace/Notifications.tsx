import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { Bell, Check, CheckCheck, ClipboardList, Inbox, MessageSquareText, UserRoundCheck } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyCard, NOTIFICATION_TITLES, QueryError, SectionHeader, ShowMore, dayLabel, timeAgo, usePaging } from "@/components/workspace-ui";

type Item = RouterOutputs["notifications"]["list"][number];
type Tab = "all" | "unread" | "complaints" | "messages" | "updates";

const TABS: { id: Tab; label: string; match: (n: Item) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "unread", label: "Unread", match: n => !n.isRead },
  { id: "complaints", label: "Complaints", match: n => n.type === "new_complaint" || n.type === "submitted" },
  { id: "messages", label: "Messages", match: n => n.type === "message" },
  { id: "updates", label: "Updates", match: n => n.type === "status_changed" || n.type === "assigned" || n.type === "staff_request" },
];

const LOOK: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  new_complaint: { icon: Inbox, tone: "bg-[#fff4e6] text-[#ba6915]" },
  submitted: { icon: ClipboardList, tone: "bg-[#eafaf1] text-[#168052]" },
  message: { icon: MessageSquareText, tone: "bg-[#f3efff] text-[#7653c4]" },
  status_changed: { icon: Check, tone: "bg-[#eaf2ff] text-[#2458c4]" },
  assigned: { icon: UserRoundCheck, tone: "bg-[#e9f7ff] text-[#1684b5]" },
  staff_request: { icon: UserRoundCheck, tone: "bg-[#fff4e6] text-[#ba6915]" },
};

export default function Notifications({ userId, onGo }: { userId: number; onGo?: (section: string) => void }) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { data, isLoading, error, refetch } = trpc.notifications.list.useQuery(undefined, { enabled: !!userId, retry: false, refetchInterval: 15_000 });
  const [tab, setTab] = useState<Tab>("all");

  const refresh = async () => {
    await utils.notifications.list.invalidate();
    await utils.notifications.summary.invalidate();
  };
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: refresh, onError: err => toast.error(err.message) });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: async () => { await refresh(); toast.success("All marked as read"); },
    onError: err => toast.error(err.message),
  });

  const items = data ?? [];
  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, items.filter(t.match).length])) as Record<Tab, number>, [items]);
  const filtered = useMemo(() => items.filter(TABS.find(t => t.id === tab)!.match), [items, tab]);
  const { visible, remaining, showMore } = usePaging(filtered, 20, tab);

  // Group the visible page by day ("Today", "Yesterday", ...), keeping the newest-first order.
  const groups = useMemo(() => {
    const result: { label: string; rows: Item[] }[] = [];
    for (const row of visible) {
      const label = dayLabel(row.createdAt);
      const last = result[result.length - 1];
      if (last?.label === label) last.rows.push(row);
      else result.push({ label, rows: [row] });
    }
    return result;
  }, [visible]);

  const open = (item: Item) => {
    if (!item.isRead) markRead.mutate({ id: item.id });
    if (item.type === "staff_request") onGo?.("staff-requests");
    else if (item.complaintId) navigate(`/workspace/complaints/${item.complaintId}`);
  };

  if (error) return <QueryError message={error.message} onRetry={() => refetch()} />;

  return (
    <>
      <SectionHeader
        eyebrow="Communications"
        title="Notifications"
        description={counts.unread > 0 ? `${counts.unread} unread. Select one to open the complaint.` : "Important updates from your complaint workspace, in one place."}
        action={counts.unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="h-9 rounded-xl border-[#cbd8ed] bg-white px-3 text-[11px] font-bold text-[#31588f]">
            <CheckCheck className="mr-1.5 h-4 w-4" />Mark all as read
          </Button>
        )}
      />

      <div className="max-w-[960px]">
        <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter notifications">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[11px] font-bold transition sm:py-1.5",
                tab === t.id ? "border-[#174cb8] bg-[#174cb8] text-white" : "border-[#cbdaf3] bg-white text-[#31588f] hover:border-[#174cb8]")}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-[10px]", tab === t.id ? "bg-white/20 text-white" : t.id === "unread" && counts.unread > 0 ? "bg-[#e5484d] text-white" : "bg-[#e5ebf3] text-[#8293ad]")}>{counts[t.id]}</span>
            </button>
          ))}
        </div>

        {isLoading && <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-[68px] animate-pulse rounded-[14px] bg-white/70" />)}</div>}

        {!isLoading && filtered.length === 0 && (
          <EmptyCard icon={<Bell className="h-10 w-10" />} title={tab === "unread" ? "You're all caught up" : "Nothing here yet"}>
            {tab === "unread" ? "No unread notifications." : "New complaints, messages and status changes will show up here."}
          </EmptyCard>
        )}

        <div className="space-y-5">
          {groups.map(group => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9dbdff]">{group.label}</h3>
              <ul className="divide-y divide-[#edf1f6] overflow-hidden rounded-[16px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
                {group.rows.map(item => {
                  const look = LOOK[item.type] ?? LOOK.message;
                  return (
                    <li key={item.id} className={cn("group flex items-start gap-3 px-4 py-3.5 transition hover:bg-[#f7faff]", !item.isRead && "bg-[#f3f8ff]")}>
                      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", look.tone)}><look.icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className={cn("text-[12px] text-[#18366f]", item.isRead ? "font-semibold" : "font-extrabold")}>{NOTIFICATION_TITLES[item.type] ?? "New notification"}</span>
                            <time dateTime={new Date(item.createdAt).toISOString()} title={format(new Date(item.createdAt), "PPP 'at' p")} className="shrink-0 text-[10px] font-semibold text-[#9aa8ba]">{timeAgo(item.createdAt)}</time>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-5 text-[#71819c]">{item.message}</span>
                        </span>
                      </button>
                      {!item.isRead ? (
                        <button type="button" onClick={() => markRead.mutate({ id: item.id })} className="tap-area mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#2458c4] hover:bg-[#e4edff]" aria-label="Mark as read" title="Mark as read"><span className="h-2 w-2 rounded-full bg-[#2458c4]" /></button>
                      ) : <span className="w-6 shrink-0" />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        {remaining > 0 && <div className="mt-3 rounded-[14px] border border-[#dbe4f1] bg-white"><ShowMore remaining={remaining} onClick={showMore} noun="older notifications" /></div>}
        {items.length >= 100 && <p className="mt-3 text-center text-[10px] text-[#9dbdff]">Showing your latest 100 notifications.</p>}
      </div>
    </>
  );
}
