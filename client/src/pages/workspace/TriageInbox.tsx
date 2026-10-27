import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Download, FileText, Inbox, MessageSquareText, Play, CheckCheck, Search } from "lucide-react";
import { STATUS_TRANSITIONS, type ComplaintStatus } from "@shared/ccms";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyCard, PriorityBadge, QueryError, SectionHeader, ShowMore, StatusBadge, ageInDays, downloadComplaintsCsv, timeAgo, usePaging } from "@/components/workspace-ui";

const STATUS_TABS = [
  { id: "All", label: "All" },
  { id: "Open", label: "Open" },
  { id: "Pending", label: "Pending" },
  { id: "In Progress", label: "Active" },
  { id: "Resolved", label: "Resolved" },
  { id: "Withdrawn", label: "Withdrawn" },
] as const;

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const SORTS = {
  newest: { label: "Newest first", compare: (a: Row, b: Row) => +new Date(b.createdAt) - +new Date(a.createdAt) },
  oldest: { label: "Oldest first", compare: (a: Row, b: Row) => +new Date(a.createdAt) - +new Date(b.createdAt) },
  priority: { label: "Most serious first", compare: (a: Row, b: Row) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || +new Date(a.createdAt) - +new Date(b.createdAt) },
  updated: { label: "Recently updated", compare: (a: Row, b: Row) => +new Date(b.updatedAt) - +new Date(a.updatedAt) },
} as const;
type SortKey = keyof typeof SORTS;

const PRIORITY_FILTERS: Record<string, { label: string; match: (priority: string) => boolean }> = {
  all: { label: "Any priority", match: () => true },
  serious: { label: "Serious (High + Critical)", match: p => p === "High" || p === "Critical" },
  Critical: { label: "Critical", match: p => p === "Critical" },
  High: { label: "High", match: p => p === "High" },
  Medium: { label: "Medium", match: p => p === "Medium" },
  Low: { label: "Low", match: p => p === "Low" },
};

type Row = RouterOutputs["staff"]["list"][number];

/** Filters the dashboard can open the inbox with ("3 waiting for days" -> Pending, oldest first). */
export type TriagePreset = { tab?: (typeof STATUS_TABS)[number]["id"]; priority?: string; sort?: SortKey; unassigned?: boolean };

const isOpen = (c: Row) => c.status === "Pending" || c.status === "In Progress";
/** A pending complaint that nobody has touched for 3+ days needs attention. */
const isOverdue = (c: Row) => c.status === "Pending" && ageInDays(c.createdAt) >= 3;

export default function TriageInbox({ preset }: { preset?: TriagePreset }) {
  const utils = trpc.useUtils();
  const { data: complaints, isLoading, error, refetch } = trpc.staff.list.useQuery(undefined, { retry: false });
  const staff = trpc.staff.listStaff.useQuery(undefined, { retry: false }).data;
  const unreadByComplaint = trpc.messages.unreadByComplaint.useQuery(undefined, { refetchInterval: 8_000, retry: false }).data;
  const unreadIds = useMemo(() => new Set((unreadByComplaint ?? []).map(u => u.complaintId)), [unreadByComplaint]);
  const staffName = useMemo(() => new Map((staff ?? []).map(m => [m.id, m.name ?? m.email ?? `Staff #${m.id}`])), [staff]);

  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["id"]>(preset?.tab ?? "All");
  const [priority, setPriority] = useState(preset?.priority ?? "all");
  const [sort, setSort] = useState<SortKey>(preset?.sort ?? "newest");
  const [unassignedOnly, setUnassignedOnly] = useState(preset?.unassigned ?? false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [assignee, setAssignee] = useState("none");
  const [showFullText, setShowFullText] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Below the xl breakpoint the panel sits under the list, so bring it into view when a complaint is picked.
  const openComplaint = (id: number) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1279px)").matches) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Always read the selected complaint from the live list, so the panel can never show stale data after a save or a refresh.
  const selected = useMemo(() => complaints?.find(c => c.id === selectedId) ?? null, [complaints, selectedId]);
  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setAssignee(selected.assignedAdminId ? String(selected.assignedAdminId) : "none");
    setRemarks("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.status, selected?.assignedAdminId]);
  useEffect(() => setShowFullText(false), [selectedId]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { All: 0, Open: 0, Pending: 0, "In Progress": 0, Resolved: 0, Withdrawn: 0 };
    for (const c of complaints ?? []) {
      result.All++;
      result[c.status]++;
      if (isOpen(c)) result.Open++;
    }
    return result;
  }, [complaints]);
  const overdueCount = useMemo(() => (complaints ?? []).filter(isOverdue).length, [complaints]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const matchPriority = PRIORITY_FILTERS[priority].match;
    return (complaints ?? [])
      .filter(c => (tab === "All" || (tab === "Open" ? isOpen(c) : c.status === tab)) && matchPriority(c.priority) && (!unassignedOnly || (isOpen(c) && !c.assignedAdminId)) && (!q || c.title.toLowerCase().includes(q) || c.consumerId.toLowerCase().includes(q) || c.location.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)))
      .sort(SORTS[sort].compare);
  }, [complaints, tab, priority, sort, deferredSearch, unassignedOnly]);
  const { visible, remaining, showMore } = usePaging(filtered, 25, `${tab}|${priority}|${sort}|${deferredSearch}|${unassignedOnly}`);

  const refresh = async () => {
    await Promise.all([
      utils.staff.list.invalidate(), utils.complaints.detail.invalidate(), utils.staff.summary.invalidate(), utils.staff.stats.invalidate(),
      utils.staff.conversations.invalidate(), utils.notifications.list.invalidate(), utils.notifications.summary.invalidate(),
    ]);
  };
  const updateStatus = trpc.staff.updateStatus.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Status updated"); },
    onError: err => toast.error(err.message),
  });
  const assign = trpc.staff.assign.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Assignment updated"); },
    onError: err => toast.error(err.message),
  });

  if (error) return <QueryError message={error.message} onRetry={() => refetch()} />;

  const allowedNext = selected ? [selected.status, ...STATUS_TRANSITIONS[selected.status]] : [];
  const canStart = selected && STATUS_TRANSITIONS[selected.status].includes("In Progress") && selected.status !== "In Progress";
  const canResolve = selected && STATUS_TRANSITIONS[selected.status].includes("Resolved");
  const statusChanged = !!selected && status !== selected.status;
  const assigneeChanged = !!selected && assignee !== (selected.assignedAdminId ? String(selected.assignedAdminId) : "none");

  return (
    <>
      <SectionHeader
        eyebrow="Staff workspace"
        title="Triage inbox"
        description="Review, assign and move complaints forward. Every change is recorded in the audit trail."
        action={
          <Button onClick={() => { downloadComplaintsCsv(filtered); toast.success(`Exported ${filtered.length} complaints`); }} disabled={!filtered.length} variant="outline" className="h-10 rounded-xl border-[#cbd8ed] bg-white px-4 text-[11px] font-bold text-[#31588f]">
            <Download className="mr-2 h-4 w-4" />Export {filtered.length || ""} to CSV
          </Button>
        }
      />

      {overdueCount > 0 && (
        <button type="button" onClick={() => { setTab("Pending"); setSort("oldest"); setPriority("all"); setUnassignedOnly(false); }} className="mb-4 flex w-full items-center gap-3 rounded-[14px] border border-[#f5d2a4] bg-[#fff5e8] px-4 py-3 text-left text-[12px] font-bold text-[#b46317] hover:bg-[#ffefd9]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{overdueCount} pending {overdueCount === 1 ? "complaint has" : "complaints have"} been waiting 3 days or more</span>
          <span className="underline">Show oldest first</span>
        </button>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div ref={listRef} className="min-w-0 scroll-mt-20 rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="space-y-3 border-b border-[#e5ebf3] p-4">
            <div className="flex flex-wrap gap-1 rounded-lg bg-[#f2f5fa] p-1" role="tablist" aria-label="Filter by status">
              {STATUS_TABS.map(item => (
                <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-2.5 text-[11px] font-bold transition sm:py-1.5", tab === item.id ? "bg-white text-[#2458c4] shadow-sm" : "text-[#8293ad] hover:text-[#2458c4]")}>
                  {item.label}<span className={cn("rounded-full px-1.5 text-[10px]", tab === item.id ? "bg-[#e4edff] text-[#2458c4]" : "bg-[#e5ebf3] text-[#8293ad]")}>{counts[item.id]}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <div className="relative col-span-2 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aabc4]" /><Input className="h-9 border-[#e0e7f1] pl-9 text-[11px]" placeholder="Search tracking number, title, location or category" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search complaints" /></div>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 w-full min-w-0 text-[11px] sm:w-[190px]" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_FILTERS).map(([key, f]) => <SelectItem key={key} value={key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sort} onValueChange={value => setSort(value as SortKey)}>
                <SelectTrigger className="h-9 w-full min-w-0 text-[11px] sm:w-[170px]" aria-label="Sort complaints"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SORTS).map(([key, s]) => <SelectItem key={key} value={key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-[#9aabc4]">Showing {visible.length} of {filtered.length}{filtered.length !== counts.All && ` (filtered from ${counts.All})`}</p>
              <button type="button" onClick={() => setUnassignedOnly(v => !v)} aria-pressed={unassignedOnly} className={cn("rounded-full border px-3.5 py-2 text-[10px] font-bold transition sm:px-3 sm:py-1", unassignedOnly ? "border-[#174cb8] bg-[#174cb8] text-white" : "border-[#cbdaf3] bg-white text-[#31588f] hover:border-[#174cb8]")}>Unassigned only</button>
            </div>
          </div>

          <div className="divide-y divide-[#edf1f6]">
            {isLoading && [1, 2, 3, 4, 5].map(i => <div key={i} className="h-[74px] animate-pulse bg-[#f6f8fc]" />)}
            {visible.map(item => {
              const overdue = isOverdue(item);
              const unread = unreadIds.has(item.id);
              return (
                <button key={item.id} type="button" onClick={() => openComplaint(item.id)} aria-pressed={selectedId === item.id}
                  className={cn("flex w-full items-start gap-3 p-4 text-left transition hover:bg-[#f7faff]", selectedId === item.id && "bg-[#eef4ff]")}>
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ff] text-[#2458c4]">
                    <FileText className="h-4 w-4" />
                    {unread && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#e5484d]" aria-label="Unread message" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12px] font-bold text-[#18366f]">{item.title}</p>
                      <StatusBadge status={item.status} />
                      {unread && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f2] px-2 py-0.5 text-[10px] font-bold text-[#bb3043]"><MessageSquareText className="h-3 w-3" />New message</span>}
                      {overdue && <span className="rounded-full bg-[#fff5e8] px-2 py-0.5 text-[10px] font-bold text-[#b46317]">Waiting {ageInDays(item.createdAt)}d</span>}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-[#8b9ab3]">
                      <span className="font-mono">{item.consumerId}</span> · {item.location} · {timeAgo(item.createdAt)}
                      {isOpen(item) && !item.assignedAdminId && " · Unassigned"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block"><PriorityBadge priority={item.priority} /></div>
                </button>
              );
            })}
            {!isLoading && !filtered.length && (
              <div className="py-14 text-center">
                <Inbox className="mx-auto h-9 w-9 text-[#c1d2f9]" />
                <p className="mt-2 text-[13px] font-bold text-[#18366f]">No complaints match</p>
                <button type="button" onClick={() => { setTab("All"); setPriority("all"); setSearch(""); setUnassignedOnly(false); }} className="mt-1 text-[11px] font-bold text-[#2458c4] hover:underline">Clear filters</button>
              </div>
            )}
          </div>
          <ShowMore remaining={remaining} onClick={showMore} noun="more complaints" />
        </div>

        <div ref={panelRef} className="min-w-0 scroll-mt-20 xl:sticky xl:top-24 xl:self-start">
          {selected ? (
            <div className="rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <div className="space-y-3 p-5">
                <button type="button" onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="tap-area -mt-1 mb-1 flex items-center gap-1 text-[11px] font-bold text-[#2458c4] xl:hidden"><ArrowLeft className="h-3.5 w-3.5" />Back to the list</button>
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={selected.status} /><PriorityBadge priority={selected.priority} /></div>
                <h3 className="text-[16px] font-extrabold leading-snug text-[#0b255f]">{selected.title}</h3>
                <p className="font-mono text-[11px] font-bold text-[#174cb8]">{selected.consumerId}</p>
                <p className={cn("whitespace-pre-wrap rounded-xl bg-[#f3f7fd] p-3 text-[12px] leading-5 text-[#3e5578]", !showFullText && "line-clamp-4")}>{selected.description}</p>
                {selected.description.length > 220 && <button type="button" onClick={() => setShowFullText(v => !v)} className="text-[11px] font-bold text-[#2458c4] hover:underline">{showFullText ? "Show less" : "Read all"}</button>}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]">
                  {([
                    ["Category", selected.category],
                    ["Location", selected.location],
                    ["Student", selected.isAnonymous ? "Anonymous" : selected.studentRef ? `ID ${selected.studentRef}` : "No Student ID"],
                    ["Assigned to", selected.assignedAdminId ? staffName.get(selected.assignedAdminId) ?? `Staff #${selected.assignedAdminId}` : "Nobody yet"],
                    ["Filed", format(new Date(selected.createdAt), "MMM d, h:mm a")],
                    ["Updated", timeAgo(selected.updatedAt)],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8ba9e9]">{k}</dt><dd className="truncate font-semibold text-[#18366f]" title={v}>{v}</dd></div>
                  ))}
                </dl>
                <Link href={`/staff/complaints/${selected.id}`} className="tap-area inline-flex items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">Open full details &amp; messages <ArrowUpRight className="h-3 w-3" /></Link>
              </div>

              {(canStart || canResolve) && (
                <div className="flex gap-2 border-t border-[#e5ebf3] px-5 py-3">
                  {canStart && <Button type="button" size="sm" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ complaintId: selected.id, status: "In Progress" })} className="h-9 flex-1 rounded-lg bg-[#1684b5] text-[11px] font-bold hover:bg-[#13719b]"><Play className="mr-1.5 h-3.5 w-3.5" />Start work</Button>}
                  {canResolve && <Button type="button" size="sm" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ complaintId: selected.id, status: "Resolved" })} className="h-9 flex-1 rounded-lg bg-[#168052] text-[11px] font-bold hover:bg-[#126b44]"><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Resolve</Button>}
                </div>
              )}

              <Separator />
              <div className="space-y-3 p-5">
                <label className="block text-[11px] font-bold text-[#5d729a]" htmlFor="triage-status">Update status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="triage-status" className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{allowedNext.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add a remark for the student (optional)" className="min-h-[72px] text-[12px]" maxLength={2000} aria-label="Remarks" />
                <Button onClick={() => updateStatus.mutate({ complaintId: selected.id, status: status as ComplaintStatus, remarks: remarks.trim() || undefined })} disabled={!statusChanged || updateStatus.isPending} className="h-10 w-full rounded-xl bg-[#174cb8] text-[12px] font-bold hover:bg-[#123d9a]">
                  {updateStatus.isPending ? "Saving…" : "Save status"}
                </Button>
              </div>
              <Separator />
              <div className="space-y-3 p-5">
                <label className="block text-[11px] font-bold text-[#5d729a]" htmlFor="triage-assign">Assign to staff</label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger id="triage-assign" className="h-9"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {staff?.map(member => <SelectItem key={member.id} value={String(member.id)}>{member.name ?? member.email ?? `Staff #${member.id}`}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => assign.mutate({ complaintId: selected.id, assignedAdminId: assignee === "none" ? null : parseInt(assignee, 10) })} disabled={!assigneeChanged || assign.isPending} variant="outline" className="h-10 w-full rounded-xl border-[#cbd8ed] text-[11px] font-bold text-[#31588f]">
                  {assign.isPending ? "Saving…" : "Save assignment"}
                </Button>
              </div>
            </div>
          ) : (
            <EmptyCard icon={<FileText className="h-10 w-10" />} title="Select a complaint">Pick one from the list to read it, change its status or assign it to a colleague.</EmptyCard>
          )}
        </div>
      </div>
    </>
  );
}
