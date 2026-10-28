import { useCallback, useEffect, useState } from "react";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Small pieces shared by the workspace pages (student and staff), kept in one place so the pages can be loaded separately.

export const statusStyles: Record<string, string> = {
  Pending: "border-[#c6d6ff] bg-[#eef3ff] text-[#204eb7]",
  "In Progress": "border-[#b8dff5] bg-[#e9f7ff] text-[#14729c]",
  Resolved: "border-[#bce5d4] bg-[#edfbf3] text-[#18794e]",
  Withdrawn: "border-[#f2b9c2] bg-[#fff0f2] text-[#bb3043]",
};

export const priorityStyles: Record<string, string> = {
  Low: "border-slate-200 bg-slate-50 text-slate-500",
  Medium: "border-[#d8cafa] bg-[#f5f0ff] text-[#6e47b8]",
  High: "border-[#f5d2a4] bg-[#fff5e8] text-[#b46317]",
  Critical: "border-[#f2b9c2] bg-[#fff0f2] text-[#bb3043]",
};

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9dbdff]">{eyebrow}</p>
        <h2 className="mt-2 text-[27px] font-extrabold tracking-[-.055em] text-white sm:text-[31px]">{title}</h2>
        <p className="mt-1.5 max-w-[650px] text-[13px] leading-6 text-[#b9ccef]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", statusStyles[status] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "Resolved" ? "bg-[#27a76c]" : status === "In Progress" ? "bg-[#1897cb]" : status === "Pending" ? "bg-[#336edb]" : "bg-[#bb3043]")} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", priorityStyles[priority] ?? priorityStyles.Medium)}>{priority}</span>;
}

export function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-[17px] border border-[#f1c9c9] bg-[#fff6f6] p-8 text-center">
      <p className="text-sm font-bold text-[#a33a3a]">Could not load this data</p>
      <p className="mt-1 text-xs text-[#7788a5]">{message}</p>
      <Button onClick={onRetry} className="mt-4 h-10 rounded-xl bg-[#174cb8] px-4 text-[11px] font-bold hover:bg-[#123d9a]">Try again</Button>
    </div>
  );
}

/** A solid card for "nothing here" states, so they stay readable on the dark page background in both themes. */
export function EmptyCard({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[17px] border border-[#dbe4f1] bg-white p-10 text-center shadow-[0_6px_24px_rgba(28,69,137,.055)]">
      <div className="text-[#c1d2f9]">{icon}</div>
      <p className="mt-3 text-[14px] font-extrabold text-[#18366f]">{title}</p>
      {children && <div className="mt-1 max-w-[320px] text-[11px] text-[#8b9ab3]">{children}</div>}
    </div>
  );
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago". */
export function timeAgo(date: Date | string) {
  const d = new Date(date);
  if (Date.now() - d.getTime() < 45_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true }).replace(" minutes", " min").replace(" minute", " min").replace(" hours", " hr").replace(" hour", " hr");
}

export function dayLabel(date: Date | string) {
  const d = new Date(date);
  return isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, MMM d");
}

export const ageInDays = (date: Date | string) => Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);

/** Long lists render a page at a time, which keeps the page fast with hundreds of complaints. Changing `resetKey` starts over. */
export function usePaging<T>(items: T[], size = 25, resetKey: unknown = "") {
  const [shown, setShown] = useState(size);
  useEffect(() => setShown(size), [resetKey, size]);
  const showMore = useCallback(() => setShown(n => n + size), [size]);
  return { visible: items.slice(0, shown), remaining: Math.max(0, items.length - shown), showMore, total: items.length };
}

export function ShowMore({ remaining, onClick, noun = "more" }: { remaining: number; onClick: () => void; noun?: string }) {
  if (remaining <= 0) return null;
  return (
    <div className="border-t border-[#edf1f6] p-3 text-center">
      <Button type="button" variant="ghost" onClick={onClick} className="h-9 rounded-xl px-4 text-[11px] font-bold text-[#2458c4]">Show {Math.min(remaining, 25)} {noun} <span className="ml-1 font-normal text-[#8b9ab3]">({remaining} left)</span></Button>
    </div>
  );
}

export type ExportRow = { consumerId: string; title: string; category: string; location: string; priority: string; status: string; isAnonymous: boolean; studentRef: string | null; createdAt: Date | string; updatedAt: Date | string };

/** Downloads complaints as CSV. Cells starting with = + - @ are prefixed so spreadsheets can't run them as formulas. */
export function downloadComplaintsCsv(rows: ExportRow[]) {
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  const lines = [
    ["Tracking ID", "Title", "Category", "Location", "Priority", "Status", "Student ID", "Created", "Updated"],
    ...rows.map(c => [c.consumerId, c.title, c.category, c.location, c.priority, c.status, c.isAnonymous ? "Anonymous" : c.studentRef ?? "", format(new Date(c.createdAt), "yyyy-MM-dd HH:mm"), format(new Date(c.updatedAt), "yyyy-MM-dd HH:mm")]),
  ];
  const blob = new Blob([lines.map(r => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `complaints-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const NOTIFICATION_TITLES: Record<string, string> = {
  status_changed: "Complaint updated",
  submitted: "Complaint submitted",
  new_complaint: "New complaint received",
  message: "New message",
  assigned: "Assignment update",
  staff_request: "Staff account request",
};

export function StatCard({ label, value, note, icon: Icon, tone, accent, hideNoteOnPhone }: { label: React.ReactNode; value: string; note: string; icon: React.ComponentType<{ className?: string }>; tone: string; accent?: string; hideNoteOnPhone?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#dbe4f1] bg-white p-4 shadow-[0_6px_24px_rgba(28,69,137,.055)] sm:p-5">
      <div className={cn("absolute right-0 top-0 h-[3px] w-[54%]", accent ?? "bg-[#3971d7]")} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8290a9] sm:text-[11px] sm:tracking-[.13em]">{label}</p>
          <p className="mt-2 text-[26px] font-extrabold tracking-[-.06em] text-[#102c6b] sm:mt-3 sm:text-[29px]">{value}</p>
          <p className={cn("mt-1 text-[10px] font-semibold text-[#7890b3] sm:mt-1.5 sm:text-[11px]", hideNoteOnPhone && "hidden sm:block")}>{note}</p>
        </div>
        <div className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl min-[420px]:flex", tone)}><Icon className="h-[18px] w-[18px]" /></div>
      </div>
    </div>
  );
}

/** One labelled horizontal bar. `max` is the value that fills the track. */
export function BarRow({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="truncate font-bold text-[#5f7497]">{label}</span>
        <span className="shrink-0 font-extrabold text-[#18366f]">{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-[#edf1f7]"><div className="h-2 rounded-full" style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%`, backgroundColor: color }} /></div>
    </div>
  );
}

/** Complaints filed per day, as columns. */
export function WeekChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map(d => d.count));
  return (
    <div className="flex h-36 items-end gap-2 sm:gap-3" role="img" aria-label="Bar chart of complaints filed per day for the last 7 days">
      {days.map(day => (
        <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] font-extrabold text-[#18366f]">{day.count}</span>
          <div className="w-full rounded-t-md bg-[#2458c4]" style={{ height: `${Math.max(day.count > 0 ? 6 : 2, (day.count / max) * 96)}px`, opacity: day.count ? 1 : 0.25 }} />
          <span className="text-[9px] font-bold text-[#8b9ab3] sm:text-[10px]">{format(new Date(`${day.date}T12:00:00`), "EEE")}<span className="hidden sm:inline"> {format(new Date(`${day.date}T12:00:00`), "d")}</span></span>
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, note, action, children, className }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[17px] border border-[#dbe4f1] bg-white p-4 shadow-[0_6px_24px_rgba(28,69,137,.055)] sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-[14px] font-extrabold tracking-[-.02em] text-[#102c6b] sm:text-[15px]">{title}</h3>{note && <p className="mt-0.5 text-[11px] text-[#8b9ab3]">{note}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}
