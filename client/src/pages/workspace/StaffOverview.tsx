import { useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, ClipboardList, Check, Clock3, Inbox, MessageSquareText, Sparkles, Target, ShieldCheck, UserX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BarRow, Panel, PriorityBadge, QueryError, SectionHeader, StatCard, StatusBadge, WeekChart, timeAgo } from "@/components/workspace-ui";
import type { TriagePreset } from "./TriageInbox";

const STATUS_COLORS = { Pending: "#336edb", "In Progress": "#1897cb", Resolved: "#27a76c", Withdrawn: "#bb3043" } as const;
const PRIORITY_COLORS = { Critical: "#d1364b", High: "#e28d32", Medium: "#8a63d2", Low: "#9aabc4" } as const;
const STATUS_LABEL: Record<string, string> = { Pending: "Submitted", "In Progress": "In progress", Resolved: "Resolved", Withdrawn: "Withdrawn" };

const formatDuration = (hours: number | null) => {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

/** Staff dashboard: what needs doing now, how the queue is moving, and who is doing what. */
export default function StaffOverview({ onGo }: { onGo: (section: string, preset?: TriagePreset) => void }) {
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const summary = trpc.staff.summary.useQuery({ tzOffsetMinutes }, { refetchInterval: 30_000, retry: false });
  const stats = trpc.staff.stats.useQuery({ tzOffsetMinutes }, { refetchInterval: 30_000, retry: false });
  const list = trpc.staff.list.useQuery(undefined, { refetchInterval: 30_000, retry: false });
  const activity = trpc.staff.activity.useQuery({ limit: 8 }, { refetchInterval: 30_000, retry: false });
  const unreadMessages = trpc.messages.unreadCount.useQuery(undefined, { refetchInterval: 15_000, retry: false }).data ?? 0;

  const s = summary.data;
  const recent = useMemo(() => [...(list.data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6), [list.data]);
  const open = (s?.pending ?? 0) + (s?.inProgress ?? 0);
  const serious = (s?.openByPriority.Critical ?? 0) + (s?.openByPriority.High ?? 0);
  const withinThreeDays = s && s.resolvedMeasured > 0 ? Math.round((s.resolvedWithin3Days / s.resolvedMeasured) * 100) : null;

  const attention = [
    { id: "overdue", icon: AlertTriangle, tone: "bg-[#fff4e6] text-[#ba6915]", label: "Waiting 3 days or more", hint: "Pending and untouched", count: s?.overduePending ?? 0, go: () => onGo("inbox", { tab: "Pending", sort: "oldest" }) },
    { id: "serious", icon: Target, tone: "bg-[#fff0f2] text-[#bb3043]", label: "Serious and still open", hint: "High and Critical priority", count: serious, go: () => onGo("inbox", { tab: "Open", priority: "serious", sort: "priority" }) },
    { id: "unassigned", icon: UserX, tone: "bg-[#edf3ff] text-[#2458c4]", label: "Not assigned to anyone", hint: "Open complaints without an owner", count: s?.unassignedOpen ?? 0, go: () => onGo("inbox", { tab: "Open", unassigned: true, sort: "priority" }) },
    { id: "unread", icon: MessageSquareText, tone: "bg-[#f3efff] text-[#7653c4]", label: "Students waiting for a reply", hint: "Unread messages", count: unreadMessages, go: () => onGo("messages") },
  ];
  const needsAction = attention.some(a => a.count > 0);
  const statusTotal = Math.max(1, s?.total ?? 0);
  const maxPriority = Math.max(1, ...(s ? Object.values(s.openByPriority) : [0]));
  const maxCategory = Math.max(1, ...(s?.byCategory.map(c => c.count) ?? [0]));
  const maxWorkload = Math.max(1, s?.unassignedOpen ?? 0, ...(s?.workload.map(w => w.count) ?? [0]));

  if (summary.error) return <QueryError message={summary.error.message} onRetry={() => summary.refetch()} />;

  return (
    <>
      <SectionHeader
        eyebrow={format(new Date(), "EEEE · MMMM d, yyyy")}
        title="Operations snapshot"
        description="What needs your attention now, how the queue is moving, and who is working on what."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onGo("inbox")} className="h-11 rounded-xl bg-[#174cb8] px-4 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]"><Inbox className="mr-2 h-4 w-4" />Open triage inbox</Button>
            <Button onClick={() => onGo("messages")} variant="outline" className="h-11 rounded-xl border-[#cbd8ed] bg-white px-4 text-[12px] font-bold text-[#31588f]"><MessageSquareText className="mr-2 h-4 w-4" />Messages{unreadMessages > 0 && <span className="ml-2 rounded-full bg-[#e5484d] px-1.5 text-[10px] text-white">{unreadMessages}</span>}</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total complaints" value={String(s?.total ?? 0)} note={`${stats.data?.today ?? 0} today · ${stats.data?.yesterday ?? 0} yesterday`} icon={ClipboardList} tone="bg-[#edf3ff] text-[#2458c4]" accent="bg-[#2458c4]" />
        <StatCard label="Needs triage" value={String(s?.pending ?? 0)} note={s?.overduePending ? `${s.overduePending} waiting 3+ days` : "Pending staff review"} icon={Inbox} tone="bg-[#fff4e6] text-[#ba6915]" accent="bg-[#e28d32]" />
        <StatCard label="In progress" value={String(s?.inProgress ?? 0)} note={`${open} open in total`} icon={Clock3} tone="bg-[#e9f7ff] text-[#1684b5]" accent="bg-[#1684b5]" />
        <StatCard label="Resolved" value={String(s?.resolved ?? 0)} note={s?.resolvedMeasured ? `Avg ${formatDuration(s.avgResolutionHours)} to resolve` : "None resolved yet"} icon={Check} tone="bg-[#eafaf1] text-[#168052]" accent="bg-[#2aad75]" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
        <Panel title="Needs your attention" note={needsAction ? "Select one to open exactly those complaints" : undefined}>
          {!needsAction && !summary.isLoading ? (
            <div className="flex flex-col items-center py-8 text-center"><CheckCircle2 className="h-9 w-9 text-[#27a76c]" /><p className="mt-2 text-[13px] font-extrabold text-[#18366f]">All clear</p><p className="mt-1 text-[11px] text-[#8b9ab3]">Nothing is overdue, unassigned or waiting for a reply.</p></div>
          ) : (
            <ul className="space-y-2">
              {attention.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={item.go} disabled={item.count === 0} className={cn("flex w-full items-center gap-3 rounded-xl border border-[#e5ebf3] p-3 text-left transition", item.count > 0 ? "hover:border-[#9cb7e9] hover:bg-[#f7faff]" : "opacity-55")}>
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", item.tone)}><item.icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-[#18366f]">{item.label}</span><span className="block truncate text-[10px] text-[#8b9ab3]">{item.hint}</span></span>
                    <span className={cn("text-[20px] font-extrabold", item.count > 0 ? "text-[#18366f]" : "text-[#27a76c]")}>{item.count}</span>
                    {item.count > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-[#9aabc4]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Complaints filed, last 7 days" note={s ? `${s.last7Days.reduce((sum, d) => sum + d.count, 0)} in total · ${stats.data?.today ?? 0} today` : "Loading…"}>
          {s ? <WeekChart days={s.last7Days} /> : <div className="h-36 animate-pulse rounded-xl bg-[#f3f6fb]" />}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Status overview" note={`${s?.total ?? 0} complaints`}>
          <div className="flex h-3 overflow-hidden rounded-full bg-[#edf1f7]" role="img" aria-label="Share of complaints by status">
            {(["Pending", "In Progress", "Resolved", "Withdrawn"] as const).map(key => {
              const count = key === "Pending" ? s?.pending : key === "In Progress" ? s?.inProgress : key === "Resolved" ? s?.resolved : s?.withdrawn;
              return <div key={key} style={{ width: `${((count ?? 0) / statusTotal) * 100}%`, backgroundColor: STATUS_COLORS[key] }} title={`${STATUS_LABEL[key]}: ${count ?? 0}`} />;
            })}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {(["Pending", "In Progress", "Resolved", "Withdrawn"] as const).map(key => {
              const count = key === "Pending" ? s?.pending : key === "In Progress" ? s?.inProgress : key === "Resolved" ? s?.resolved : s?.withdrawn;
              return (
                <li key={key} className="flex items-center gap-2 text-[11px]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} /><span className="flex-1 truncate font-bold text-[#5f7497]">{STATUS_LABEL[key]}</span><span className="font-extrabold text-[#18366f]">{count ?? 0}</span><span className="w-9 text-right text-[10px] text-[#9aabc4]">{Math.round(((count ?? 0) / statusTotal) * 100)}%</span></li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Open by priority" note={`${open} complaints still open`}>
          <div className="space-y-3.5">
            {(["Critical", "High", "Medium", "Low"] as const).map(key => <BarRow key={key} label={key} value={s?.openByPriority[key] ?? 0} max={maxPriority} color={PRIORITY_COLORS[key]} />)}
          </div>
        </Panel>

        <Panel title="Top categories" note="Where complaints come from" className="md:col-span-2 xl:col-span-1">
          <div className="space-y-3.5">
            {s?.byCategory.slice(0, 5).map(cat => <BarRow key={cat.category} label={cat.category} value={cat.count} max={maxCategory} color="#2458c4" />)}
            {s && !s.byCategory.length && <p className="text-[11px] text-[#8b9ab3]">No complaints yet.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Latest complaints" action={<button type="button" onClick={() => onGo("inbox")} className="tap-area flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">View all <ArrowUpRight className="h-3.5 w-3.5" /></button>}>
          <ul className="divide-y divide-[#edf1f6]">
            {recent.map(c => (
              <li key={c.id}>
                <Link href={`/staff/complaints/${c.id}`} className="flex items-center gap-3 py-3 transition hover:bg-[#f7faff] sm:-mx-2 sm:px-2 sm:rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-[12px] font-bold text-[#18366f]">{c.title}</p><StatusBadge status={c.status} /></div>
                    <p className="mt-1 truncate text-[10px] text-[#8b9ab3]"><span className="font-mono">{c.consumerId}</span> · {c.location} · {timeAgo(c.createdAt)}</p>
                  </div>
                  <PriorityBadge priority={c.priority} />
                </Link>
              </li>
            ))}
            {!recent.length && !list.isLoading && <li className="py-8 text-center text-[12px] text-[#8b9ab3]">No complaints yet.</li>}
          </ul>
        </Panel>

        <Panel title="Recent activity" note="Status changes and assignments">
          <ol className="relative ml-1.5 space-y-4 border-l-2 border-[#e5ebf3] pl-5">
            {activity.data?.map(a => {
              const note = a.oldStatus === a.newStatus;
              return (
                <li key={a.id} className="relative">
                  <span className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white", note ? "bg-[#9aabc4]" : a.newStatus === "Resolved" ? "bg-[#27a76c]" : "bg-[#174cb8]")} />
                  <p className="text-[12px] leading-5 text-[#18366f]">
                    <span className="font-bold">{a.actor}</span>{" "}
                    {note ? "updated" : a.oldStatus ? <>moved <span className="font-bold">{STATUS_LABEL[a.newStatus]?.toLowerCase()}</span> for</> : "filed"}{" "}
                    <Link href={`/staff/complaints/${a.complaintId}`} className="tap-area font-mono text-[11px] font-bold text-[#2458c4] hover:underline">{a.consumerId}</Link>
                  </p>
                  <p className="truncate text-[11px] text-[#8b9ab3]">{a.remarks ?? a.title}</p>
                  <p className="text-[10px] font-semibold text-[#9aabc4]">{timeAgo(a.changedAt)}</p>
                </li>
              );
            })}
            {!activity.data?.length && !activity.isLoading && <li className="text-[12px] text-[#8b9ab3]">No activity yet.</li>}
          </ol>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 pb-4 md:grid-cols-2">
        <Panel title="Staff workload" note="Open complaints per person">
          <div className="space-y-3.5">
            {s?.workload.map(w => <BarRow key={w.adminId} label={w.name} value={w.count} max={maxWorkload} color="#174cb8" />)}
            {s && s.unassignedOpen > 0 && <BarRow label="Unassigned" value={s.unassignedOpen} max={maxWorkload} color="#e28d32" />}
            {s && !s.workload.length && !s.unassignedOpen && <p className="text-[11px] text-[#8b9ab3]">No open complaints.</p>}
          </div>
        </Panel>

        <Panel title="Performance" note="Measured from real resolutions and feedback">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Target, tone: "bg-[#edfbf3] text-[#168052]", label: "Avg. time to resolve", value: formatDuration(s?.avgResolutionHours ?? null) },
              { icon: ShieldCheck, tone: "bg-[#edf3ff] text-[#2458c4]", label: "Within 3 days", value: withinThreeDays === null ? "—" : `${withinThreeDays}%` },
              { icon: Sparkles, tone: "bg-[#fff4e6] text-[#ba6915]", label: "Satisfaction", value: s?.avgRating == null ? "—" : `${s.avgRating.toFixed(1)}/5` },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-[#e5ebf3] p-3 text-center">
                <span className={cn("mx-auto flex h-8 w-8 items-center justify-center rounded-lg", item.tone)}><item.icon className="h-4 w-4" /></span>
                <p className="mt-2 text-[18px] font-extrabold text-[#102c6b] sm:text-[20px]">{item.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#8b9ab3]">{item.label}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onGo("reports")} className="tap-area mt-4 flex items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">Full reports <ArrowUpRight className="h-3.5 w-3.5" /></button>
        </Panel>
      </div>
    </>
  );
}
