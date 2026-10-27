import { Suspense, lazy, useEffect, useMemo, useState, useRef } from "react";
import { PROFANITY_MESSAGE, findProfanity, maskWord } from "@shared/profanity";
import { STATUS_TRANSITIONS, isConsumerId, normalizeConsumerId, type ComplaintStatus } from "@shared/ccms";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { AlertCircle, Archive, ArrowUpRight, BarChart3, Bell, Building2, Check, ChevronDown, ClipboardList, Clock3, FileImage, FileText, Filter, FolderOpen, Grid2X2, Headphones, Inbox, LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Loader2, Menu, MessageSquareText, Monitor, MoreHorizontal, Paperclip, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Target, UploadCloud, UserRound, UsersRound, X, ArrowLeft, Copy, CheckCircle2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { format, isToday, isYesterday } from "date-fns";
import ComplaintChat from "@/components/ComplaintChat";
import { EmptyCard, NOTIFICATION_TITLES, PriorityBadge, QueryError, SectionHeader, StatCard, StatusBadge, downloadComplaintsCsv } from "@/components/workspace-ui";
import type { TriagePreset } from "./workspace/TriageInbox";
import AssistantWidget from "@/components/AssistantWidget";
import { useTheme } from "@/contexts/ThemeContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Loaded on demand: a student never downloads the staff screens, and nobody downloads a page they have not opened.
const TriageInbox = lazy(() => import("./workspace/TriageInbox"));
const StaffMessages = lazy(() => import("./workspace/StaffMessages"));
const Notifications = lazy(() => import("./workspace/Notifications"));
const StaffOverview = lazy(() => import("./workspace/StaffOverview"));

function ContentLoader() {
  return <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading"><Loader2 className="h-6 w-6 animate-spin text-[#9fc4ff]" /></div>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#8bb6ff]/60 bg-[#174cb8] text-white shadow-[0_8px_24px_rgba(20,76,184,.24)]">
        <div className="absolute inset-[7px] border border-white/60" />
        <div className="absolute h-[2px] w-6 bg-white/80" />
        <div className="absolute h-6 w-[2px] bg-white/80" />
        <span className="relative text-[10px] font-black tracking-tight">CC</span>
      </div>
      {!compact && <div className="min-w-0"><p className="text-[15px] font-extrabold tracking-[-.03em] text-white">CCMS</p><p className="text-[9px] font-bold uppercase tracking-[.22em] text-[#9bbcff]">Campus systems</p></div>}
    </div>
  );
}

function BlueprintBackdrop() {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60" aria-hidden="true"><div className="blueprint-grid absolute inset-0" /><div className="blueprint-crosshair left-[9%] top-[26%]" /><div className="blueprint-crosshair right-[9%] top-[34%]" /><div className="blueprint-dimension left-[11%] top-[24%] h-[1px] w-[19%]" /><div className="blueprint-dimension right-[11%] top-[39%] h-[1px] w-[17%]" /></div>;
}

function Shell({ children, mode, section, setSection, logout, userName, userEmail }: { children: React.ReactNode; mode: "student" | "staff"; section: string; setSection: (section: string) => void; logout: () => void; userName: string; userEmail: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  // One small request drives every badge and the pop-up (it replaces separate polled queries).
  const summary = trpc.notifications.summary.useQuery(undefined, { refetchInterval: 6_000, retry: false });
  const unreadNotifications = summary.data?.unreadNotifications ?? 0;
  const unreadMessages = summary.data?.unreadMessages ?? 0;

  // Pop up a toast when something new arrives (a staff reply, a student message, a new complaint). The first load only records
  // what is already there, so old unread items don't all pop up at once.
  const lastSeen = useRef<number | null>(null);
  useEffect(() => {
    if (!summary.data) return;
    const latest = summary.data.latest;
    if (lastSeen.current === null) {
      lastSeen.current = latest?.id ?? 0;
      return;
    }
    if (latest && latest.id > lastSeen.current) {
      lastSeen.current = latest.id;
      let popups = true;
      try { popups = localStorage.getItem("ccms-popups") !== "off"; } catch { /* storage blocked: keep pop-ups on */ }
      if (popups) {
        toast(NOTIFICATION_TITLES[latest.type] ?? "New notification", {
          description: latest.message,
          duration: 8000,
          action: latest.complaintId ? { label: "Open", onClick: () => navigate(`/workspace/complaints/${latest.complaintId}`) } : undefined,
        });
      }
    }
  }, [summary.data, navigate]);
  const initials = (userName || (mode === "student" ? "Student" : "Staff")).split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const nav: { id: string; label: string; icon: any; badge?: number }[] = mode === "student" ? [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "my-complaints", label: "My complaints", icon: ClipboardList },
    { id: "submit", label: "Submit complaint", icon: Plus },
    { id: "track", label: "Track complaint", icon: Search, badge: unreadMessages },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifications },
  ] : [
    { id: "overview", label: "Command center", icon: LayoutDashboard },
    { id: "inbox", label: "Triage inbox", icon: Inbox },
    { id: "messages", label: "Messages", icon: MessageSquareText, badge: unreadMessages },
    { id: "reports", label: "Reports & trends", icon: BarChart3 },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifications },
  ];
  const go = (id: string) => { setSection(id); setMobileOpen(false); };
  return <div className="blueprint-app min-h-dvh bg-[#061b56] text-slate-950">
    <BlueprintBackdrop />
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-white/10 bg-[#071e5c] px-4 py-5 shadow-2xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><BrandMark /><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden" aria-label="Close navigation"><X className="h-4 w-4" /></button></div>
      <div className="mt-8 px-2"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7192d8]">Workspace</p><nav className="mt-3 space-y-1">{nav.map(item => <button key={item.id} onClick={() => go(item.id)} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition", section === item.id ? "bg-white text-[#123d9a] shadow-[0_8px_20px_rgba(0,0,0,.16)]" : "text-[#c1d2f9] hover:bg-white/[.09] hover:text-white")}><item.icon className={cn("h-[16px] w-[16px]", section === item.id ? "text-[#174cb8]" : "text-[#90b2f6]")} /><span className="flex-1">{item.label}</span>{!!item.badge && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e5484d] px-1.5 text-[10px] font-bold text-white" aria-label={`${item.badge} unread`}>{item.badge > 99 ? "99+" : item.badge}</span>}</button>)}</nav></div>
      <div className="mt-auto space-y-1 px-2"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#7192d8]">System</p><Link href="/workspace/settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold text-[#c1d2f9] hover:bg-white/[.09] hover:text-white"><Settings2 className="h-4 w-4 text-[#90b2f6]" />Settings</Link><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold text-[#c1d2f9] hover:bg-white/[.09] hover:text-white"><LogOut className="h-4 w-4 text-[#90b2f6]" />Sign out</button></div>
      <div className="mt-5 border-t border-white/10 px-2 pt-5">
        <Link href="/workspace/settings" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9e5ff] text-[11px] font-extrabold text-[#174cb8]">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-white">{userName || "User"}</p>
            <p className="truncate text-[10px] text-[#90a9dc]">{mode === "student" ? "Student" : "Staff"}</p>
          </div>
          <MoreHorizontal className="ml-auto h-4 w-4 text-[#8ba9e9]" />
        </Link>
      </div>
    </aside>
    {mobileOpen && <button onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#06163f]/70 lg:hidden" aria-label="Close navigation overlay" />}
    <main className="relative min-h-dvh lg:pl-[252px]"><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#d8e1f1] bg-[#f7f9fd]/90 px-5 backdrop-blur-xl lg:px-9"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#5d729a] hover:bg-[#eaf0fa] lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#7788a5]">{mode === "student" ? "Student portal" : "Staff console"}</p><h1 className="mt-0.5 text-[17px] font-extrabold tracking-[-.03em] text-[#0b255f]">{mode === "student" ? "My complaint desk" : <><span className="sm:hidden">Command center</span><span className="hidden sm:inline">Operations command center</span></>}</h1></div></div><div className="flex items-center gap-2.5"><button onClick={() => go("notifications")} className="relative rounded-xl border border-[#d9e2f0] bg-white p-2.5 text-[#5e7498] shadow-sm hover:border-[#9cb7e9]" aria-label={`View notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}><Bell className="h-[17px] w-[17px]" />{unreadNotifications > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e5484d] px-1 text-[9px] font-bold text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</button><button onClick={() => toggleTheme?.()} className="rounded-xl border border-[#d9e2f0] bg-white p-2.5 text-[#5e7498] shadow-sm hover:border-[#9cb7e9]" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}</button><div className="hidden h-8 w-px bg-[#dce4f0] sm:block" /><DropdownMenu><DropdownMenuTrigger className="flex items-center gap-2 rounded-xl p-1 outline-none hover:bg-[#eaf0fa] focus-visible:ring-2 focus-visible:ring-[#3971d7]" aria-label="Account menu"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe6ff] text-[10px] font-extrabold text-[#174cb8]">{initials}</span><ChevronDown className="hidden h-3.5 w-3.5 text-[#7487a5] sm:block" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel className="font-normal"><p className="truncate text-[13px] font-bold text-[#18366f]">{userName || "User"}</p><p className="truncate text-[11px] text-[#8b9ab3]">{userEmail || (mode === "student" ? "Student" : "Staff")}</p></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("/workspace/settings?tab=profile")}><UserRound className="h-4 w-4" />My profile</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("/workspace/settings")}><Settings2 className="h-4 w-4" />Settings</DropdownMenuItem><DropdownMenuItem onSelect={() => toggleTheme?.()}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{theme === "dark" ? "Light mode" : "Dark mode"}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => logout()} className="text-[#bb3043] focus:text-[#bb3043]"><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header><div className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-5 sm:pt-7 lg:px-9">{children}</div></main>
  </div>;
}

function ComplaintRow({ item, onClick, showStudent = false }: { item: any; onClick: () => void; showStudent?: boolean }) {
  return <button onClick={onClick} className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-[#d8e4f7] hover:bg-[#f7faff]"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ff] text-[#2458c4]"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[12px] font-bold text-[#18366f]">{item.title}</p><StatusBadge status={item.status} /></div><p className="mt-1 truncate text-[10px] text-[#8b9ab3]">{item.consumerId} · {item.location}{showStudent && ` · ${item.isAnonymous ? "Anonymous" : item.studentRef ? `Student ID ${item.studentRef}` : "No Student ID"}`}</p></div><div className="hidden text-right sm:block"><PriorityBadge priority={item.priority} /><p className="mt-1 text-[10px] text-[#9aa7ba]">{format(new Date(item.updatedAt), "MMM d, yyyy")}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-[#b0bfd4] transition group-hover:text-[#2458c4]" /></button>;
}

function TimelineDot({ color, title, time, detail }: { color: string; title: string; time: string; detail: string }) { return <div className="relative mb-6 last:mb-0"><span className={cn("absolute -left-[25px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#f6f9ff] ring-1 ring-[#bcd0f4]", color)} /><p className="text-[12px] font-bold text-[#18366f]">{title}</p><p className="mt-0.5 text-[10px] font-bold text-[#6b82ae]">{time}</p><p className="mt-1 text-[11px] leading-5 text-[#8291aa]">{detail}</p></div>; }

function PrivacyNote() { return <div className="mt-6 flex items-start gap-3 rounded-[15px] border border-[#cbdaf3] bg-[#edf4ff] p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#2458c4]" /><div><p className="text-[11px] font-extrabold text-[#183d88]">Your privacy is built in</p><p className="mt-1 text-[11px] leading-5 text-[#5d76a4]">Sensitive complaints can be submitted anonymously. Your identity stays restricted to authorized safeguarding staff.</p></div></div>; }

function TrackingNumber({ id, size = "sm" }: { id: string; size?: "sm" | "lg" }) {
  const copy = async (e: React.MouseEvent) => {
    // Rows are links, so stop the click from opening the complaint.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Tracking number copied");
    } catch {
      toast.error("Could not copy", { description: id });
    }
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border border-[#cbdaf3] bg-[#edf4ff] font-mono font-bold text-[#174cb8] ${size === "lg" ? "px-4 py-2.5 text-xl tracking-wide" : "px-2 py-1 text-[10px]"}`}>
      {id}
      <button type="button" onClick={copy} aria-label={`Copy tracking number ${id}`} className="tap-area rounded p-0.5 text-[#5d729a] hover:text-[#174cb8]">
        <Copy className={size === "lg" ? "h-5 w-5" : "h-3 w-3"} />
      </button>
    </span>
  );
}

function SubmitComplaint({ onDone, onTrack }: { onDone: () => void; onTrack: (consumerId: string) => void }) {
  const [submitted, setSubmitted] = useState<{ consumerId: string; internalId: number } | null>(null);
  if (!submitted) return <SubmitForm onSubmitted={setSubmitted} />;
  return (
    <div className="mx-auto max-w-xl rounded-[17px] border border-[#dbe4f1] bg-white p-10 text-center shadow-[0_6px_24px_rgba(28,69,137,.055)]">
      <CheckCircle2 className="mx-auto h-12 w-12 text-[#27a76c]" />
      <h2 className="mt-4 text-xl font-extrabold text-[#0b255f]">Complaint submitted</h2>
      <p className="mt-2 text-[13px] text-[#5d729a]">Save your tracking number. Use it to check progress at any time, even without logging in.</p>
      <div className="mt-6"><TrackingNumber id={submitted.consumerId} size="lg" /></div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={() => onTrack(submitted.consumerId)} className="h-11 rounded-xl bg-[#174cb8] px-5 text-[12px] font-bold hover:bg-[#123d9a]">Track this complaint</Button>
        <Button variant="outline" onClick={onDone} className="h-11 rounded-xl border-[#cbdaf3] px-5 text-[12px] font-bold text-[#174cb8]">View my complaints</Button>
        <Link href={`/workspace/complaints/${submitted.internalId}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#cbdaf3] px-5 text-[12px] font-bold text-[#174cb8] hover:bg-[#f7faff]">Open this complaint</Link>
      </div>
    </div>
  );
}

function SubmitForm({ onSubmitted }: { onSubmitted: (result: { consumerId: string; internalId: number }) => void }) {
  const utils = trpc.useUtils();
  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: async (result) => {
      const { consumerId } = result as { consumerId: string; internalId: number };
      toast.success("Complaint submitted!", { description: `Your tracking number is ${consumerId}` });
      await utils.complaints.mine.invalidate();
      await utils.notifications.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addAttachment = trpc.complaints.attachment.useMutation({
    onSuccess: () => toast.success("Attachment uploaded"),
    onError: (err) => toast.error(err.message),
  });

  // The draft is kept in this browser (per signed-in user), so a refresh or a lost connection never costs the student their text.
  const { user } = useAuth();
  const draftKey = `ccms-complaint-draft-${user?.id ?? "guest"}`;
  const draft = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) ?? "null") as Partial<Record<"category" | "title" | "location" | "description" | "priority", string> & { anonymous: boolean }> | null; } catch { return null; }
  }, [draftKey]);
  const [category, setCategory] = useState(draft?.category ?? "Infrastructure");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [location, setLocation] = useState(draft?.location ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [step, setStep] = useState(1);
  const [anonymous, setAnonymous] = useState(draft?.anonymous ?? false);
  // Content guard: abusive language (English / Malayalam / Manglish) blocks the form; the server re-checks on submit.
  const flagged = useMemo(() => findProfanity(`${title}\n${description}\n${location}`), [title, description, location]);
  const [priority, setPriority] = useState(draft?.priority ?? "Medium");
  const [draftSaved, setDraftSaved] = useState(!!(draft && (draft.title || draft.description || draft.location)));
  useEffect(() => {
    const hasText = !!(title.trim() || description.trim() || location.trim());
    try {
      if (hasText) localStorage.setItem(draftKey, JSON.stringify({ category, title, location, description, priority, anonymous }));
      else localStorage.removeItem(draftKey);
    } catch { /* storage blocked: nothing is saved, the form still works */ }
    setDraftSaved(hasText);
  }, [draftKey, category, title, location, description, priority, anonymous]);
  const clearDraft = () => {
    setTitle(""); setDescription(""); setLocation(""); setCategory("Infrastructure"); setPriority("Medium"); setAnonymous(false); setStep(1);
    toast.success("Draft cleared");
  };
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast.error("Invalid file type. Use JPG, PNG, or PDF.");
      return;
    }
    if (file.size > 10_000_000) {
      toast.error("File too large. Maximum 10 MB.");
      return;
    }
    setAttachment(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (flagged.length > 0) {
      toast.error("Complaint blocked", { description: PROFANITY_MESSAGE });
      setStep(2);
      return;
    }
    if (!title || !description || !location || !category) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // First create the complaint
      const result = await createComplaint.mutateAsync({
        category,
        title,
        description,
        location,
        priority: priority as any,
        isAnonymous: anonymous,
      });

      const created = result as { consumerId: string; internalId: number };
      const { internalId } = created;

      // Then upload attachment if present
      if (attachment) {
        setUploading(true);
        const base64 = await fileToBase64(attachment);
        await addAttachment.mutateAsync({
          complaintId: internalId,
          fileName: attachment.name,
          mimeType: attachment.type as any,
          dataBase64: base64,
          sizeBytes: attachment.size,
        });
      }

      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      onSubmitted(created);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  return (
    <>
      <SectionHeader
        eyebrow="Student request desk"
        title="Submit a complaint"
        description="Give campus teams the context they need to respond quickly. Your text is saved as you type."
        action={draftSaved ? <button type="button" onClick={clearDraft} className="self-start rounded-full border border-[#d7e2f4] bg-white px-3 py-2 text-[10px] font-bold text-[#6b7e9d] hover:border-[#bb3043] hover:text-[#bb3043] sm:self-auto" title="Clear the saved draft">Draft saved · Clear</button> : <span className="self-start rounded-full border border-[#d7e2f4] bg-white px-3 py-2 text-[10px] font-bold text-[#6b7e9d] sm:self-auto">Drafts save automatically</span>}
      />
      <form onSubmit={handleSubmit} className="grid gap-7 xl:grid-cols-[1fr_310px]">
        <div className="rounded-[18px] border border-[#dbe4f1] bg-white p-5 shadow-[0_6px_24px_rgba(28,69,137,.055)] sm:p-7">
          <div className="mb-8 flex items-center gap-2 sm:gap-3">
            {["Category", "Details", "Evidence", "Review"].map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2 last:flex-none">
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black", step > i + 1 ? "bg-[#2aad75] text-white" : step === i + 1 ? "bg-[#174cb8] text-white" : "bg-[#edf2fa] text-[#8da0bd]")}>
                  {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : `0${i + 1}`}
                </div>
                <span className={cn("hidden text-[10px] font-bold sm:block", step === i + 1 ? "text-[#174cb8]" : "text-[#8da0bd]")}>{label}</span>
                {i < 3 && <div className={cn("h-px flex-1", step > i + 1 ? "bg-[#88d6b1]" : "bg-[#e0e7f2]")} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">What is this about?</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["Classroom issue", "Cleanliness", "Infrastructure", "Ragging / safeguarding", "Hostel & residence", "Other"].map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setCategory(item); setStep(2); }}
                      className="flex items-center justify-between rounded-xl border border-[#dce5f1] bg-white px-4 py-3 text-left text-[12px] font-bold text-[#274777] transition hover:border-[#7fa4e6] hover:bg-[#f5f8ff]"
                    >
                      <span>{item}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#9cb1d1]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief, specific title" className="h-10" maxLength={180} required />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail..." className="min-h-[140px]" maxLength={10000} required />
              </div>
              <div className="-mt-2 space-y-2">
                <p className="text-[10px] text-[#8b9ab3]">An automatic content check blocks abusive language (English and Malayalam) before a complaint can be sent.</p>
                {flagged.length > 0 && (
                  <div role="alert" className="rounded-xl border border-[#f1c9c9] bg-[#fff6f6] p-3 text-[12px] text-[#a33a3a]">
                    <p className="font-bold">This complaint can't be submitted yet</p>
                    <p className="mt-1">{PROFANITY_MESSAGE}</p>
                    <p className="mt-1 text-[11px] text-[#c05a5a]">Found: {flagged.map(maskWord).join(", ")}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Location</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Building, room, area" className="h-10" maxLength={180} required />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="anonymous" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 rounded border-[#dce5f1] text-[#174cb8] focus:ring-[#3971d7] sm:h-4 sm:w-4" />
                <label htmlFor="anonymous" className="text-[12px] font-medium text-[#274777]">Submit anonymously (identity hidden from staff, visible only to safeguarding)</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="button" onClick={() => setStep(3)} disabled={flagged.length > 0}>Next</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Attach evidence (optional)</label>
                <div className="relative">
                  {/* The invisible input only covers the box while it is empty; otherwise it would swallow clicks on Replace/Remove. */}
                  <input
                    type="file"
                    id="evidence-upload"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileSelect}
                    className={attachment ? "hidden" : "absolute inset-0 h-full w-full opacity-0 cursor-pointer"}
                    disabled={uploading}
                  />
                  <div className={cn("flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition", attachment ? "border-[#2aad75] bg-[#eafaf1]" : "border-[#dce5f1] bg-white hover:border-[#7fa4e6] hover:bg-[#f5f8ff]")}>
                    <UploadCloud className="h-10 w-10 text-[#9aabc4]" />
                    <p className="mt-3 text-[12px] font-bold text-[#18366f]">{attachment ? `Selected: ${attachment.name}` : "Drag & drop or click to upload"}</p>
                    <p className="text-[10px] text-[#8b9ab3]">JPG, PNG, PDF · Max 10 MB</p>
                    {attachment && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          <UploadCloud className="mr-1 h-3.5 w-3.5" />
                          Replace image
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAttachment} disabled={uploading} className="text-[#bb3043] hover:bg-[#fff0f2]">
                          <X className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button type="button" onClick={() => setStep(4)}>Next</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-xl bg-[#f3f7fd] p-4">
                <p className="text-[11px] font-bold text-[#18366f] mb-3">Review your complaint</p>
                <dl className="space-y-3 text-[11px]">
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Category</dt><dd className="font-medium text-[#18366f]">{category}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Title</dt><dd className="font-medium text-[#18366f]">{title}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Location</dt><dd className="font-medium text-[#18366f]">{location}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Priority</dt><dd><PriorityBadge priority={priority} /></dd></div>
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Anonymous</dt><dd className="font-medium text-[#18366f]">{anonymous ? "Yes" : "No"}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#8b9ab3]">Attachment</dt><dd className="font-medium text-[#18366f]">{attachment ? attachment.name : "None"}</dd></div>
                </dl>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button type="submit" disabled={createComplaint.isPending || uploading || flagged.length > 0}>
                  {createComplaint.isPending || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Complaint"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="rounded-[18px] border border-[#dbe4f1] bg-white p-5 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Need help?</p>
            <Button variant="ghost" size="icon" className="text-[#5d729a] hover:text-[#174cb8]">
              <MessageSquareText className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 text-[11px] text-[#5d76a4]">
            <p>• Be specific in your description</p>
            <p>• Include location details</p>
            <p>• Attach photos if relevant</p>
            <p>• Select appropriate priority</p>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e5ebf3]">
            <Button variant="outline" className="w-full text-[11px] font-bold text-[#5d729a] hover:bg-[#f0f4fa]">
              <MessageSquareText className="mr-2 h-3.5 w-3.5" />
              Contact Support
            </Button>
          </div>
          <PrivacyNote />
        </div>
      </form>
    </>
  );
}

function StudentComplaints({ setSection }: { setSection: (section: string) => void }) {
  const utils = trpc.useUtils();
  const { data: complaints, isLoading, error, refetch } = trpc.complaints.mine.useQuery(undefined, { retry: false });

  return (
    <>
      <SectionHeader
        eyebrow="Your record"
        title="My complaints"
        description="Track every request from first submission to resolution. Select a complaint to see the full audit trail."
        action={<Button onClick={() => setSection("submit")} className="h-10 rounded-xl bg-[#174cb8] px-4 text-[11px] font-bold hover:bg-[#123d9a]"><Plus className="mr-2 h-4 w-4" />New complaint</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 rounded-[15px] border border-[#dbe4f1] bg-white p-3 shadow-sm sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aabc4]" /><Input className="h-9 border-0 bg-[#f6f8fc] pl-9 text-[11px] shadow-none" placeholder="Search by Consumer ID or keyword" /></div>
        <Button variant="outline" className="flex items-center justify-center gap-2 rounded-lg border border-[#dbe4f1] px-3 text-[11px] font-bold text-[#657b9e]"><Filter className="h-3.5 w-3.5" />Filters</Button>
      </div>
      {error ? (
        <QueryError message={error.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-[#3971d7] border-t-transparent" /></div>
        </div>
      ) : complaints?.length === 0 ? (
        <div className="rounded-[17px] border border-[#dbe4f1] bg-white p-12 text-center shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <FileText className="mx-auto h-12 w-12 text-[#c1d2f9]" />
          <p className="mt-4 text-[15px] font-extrabold text-[#18366f]">No complaints yet</p>
          <p className="mt-2 text-[11px] text-[#8b9ab3]">Submit your first complaint to get started</p>
          <Button onClick={() => setSection("submit")} className="mt-4 h-11 rounded-xl bg-[#174cb8] px-5 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]"><Plus className="mr-2 h-4 w-4" />Submit complaint</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[17px] border border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="hidden grid-cols-[1.7fr_1.1fr_.8fr_.8fr_32px] gap-4 border-b border-[#e5ebf3] bg-[#f9fbfe] px-5 py-3 text-[10px] font-black uppercase tracking-[.12em] text-[#8a9bb5] md:grid">
            <span>Complaint</span>
            <span>Category / location</span>
            <span>Status</span>
            <span>Priority</span>
            <span />
          </div>
          {complaints?.map(item => (
            <Link key={item.id} href={`/workspace/complaints/${item.id}`} className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-2.5 border-b border-[#edf1f6] px-4 py-3.5 last:border-0 md:grid-cols-[1.7fr_1.1fr_.8fr_.8fr_32px] md:items-center md:gap-4 md:px-5 md:py-4">
              <div className="col-span-3 md:col-span-1"><p className="text-[12px] font-bold text-[#18366f]">{item.title}</p><div className="mt-1.5"><TrackingNumber id={item.consumerId} /></div><p className="mt-1.5 text-[10px] text-[#8a9ab2]">Updated {format(new Date(item.updatedAt), "MMM d, yyyy")}</p></div>
              <div className="order-last col-span-3 flex flex-wrap items-baseline gap-x-2 md:order-none md:col-span-1 md:block"><p className="text-[11px] font-semibold text-[#5f7497]">{item.category}</p><p className="text-[10px] text-[#98a6ba] md:mt-1">{item.location}</p></div>
              <div className="justify-self-start"><StatusBadge status={item.status} /></div>
              <div className="justify-self-start"><PriorityBadge priority={item.priority} /></div>
              <div className="hidden items-center justify-end md:flex"><ArrowUpRight className="h-4 w-4 text-[#b0bfd4]" /></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const FLOW = ["Pending", "In Progress", "Resolved"] as const;
const FLOW_LABEL: Record<string, string> = { Pending: "Submitted", "In Progress": "In progress", Resolved: "Resolved", Withdrawn: "Withdrawn" };
const FLOW_HINT: Record<string, string> = {
  Pending: "We received your complaint. It is waiting for a staff member to pick it up.",
  "In Progress": "Staff are working on your complaint.",
  Resolved: "Your complaint was marked resolved. You can now leave feedback.",
  Withdrawn: "This complaint was withdrawn and is closed.",
};

type TrackHistory = { id: number; oldStatus: string | null; newStatus: string; remarks: string | null; changedAt: Date | string };

/** Parcel-tracking style progress bar: Submitted -> In progress -> Resolved (or Withdrawn). */
function StatusFlow({ status, createdAt, history }: { status: string; createdAt: Date | string; history: TrackHistory[] }) {
  const timeFor = (step: string) => {
    if (step === "Pending") return createdAt;
    return history.find(h => h.newStatus === step && h.oldStatus !== h.newStatus)?.changedAt ?? null;
  };
  const withdrawn = status === "Withdrawn";
  const steps = withdrawn ? ["Pending", "Withdrawn"] : [...FLOW];
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="flex w-full items-start" aria-label="Complaint progress">
      {steps.map((step, i) => {
        const done = i < currentIndex || (i === currentIndex && status === "Resolved");
        const current = i === currentIndex && !done;
        const bad = step === "Withdrawn";
        const when = done || current ? timeFor(step) : null;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute right-1/2 top-[17px] h-[3px] w-full", i <= currentIndex ? (bad ? "bg-[#d96b78]" : "bg-[#2aad75]") : "bg-[#dbe4f1]")} />}
            <span className={cn(
              "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-[3px] text-[12px] font-black",
              done && "border-[#2aad75] bg-[#2aad75] text-white",
              current && !bad && "border-[#174cb8] bg-white text-[#174cb8] shadow-[0_0_0_6px_rgba(23,76,184,.15)]",
              current && bad && "border-[#d96b78] bg-[#d96b78] text-white",
              !done && !current && "border-[#dbe4f1] bg-white text-[#b0bfd4]",
            )}>
              {done ? <Check className="h-4 w-4" /> : bad ? <X className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[12px] font-extrabold", done || current ? "text-[#18366f]" : "text-[#9aabc4]")}>{FLOW_LABEL[step]}</span>
            <span className="mt-0.5 text-[10px] text-[#8b9ab3]">{when ? format(new Date(when), "MMM d, h:mm a") : current ? "Now" : "Pending"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TrackComplaint({ initialId, onOpenSubmit }: { initialId?: string; onOpenSubmit: () => void }) {
  const [input, setInput] = useState(initialId ?? "");
  const [trackedId, setTrackedId] = useState<string | null>(initialId ? normalizeConsumerId(initialId) : null);
  const [formatError, setFormatError] = useState("");

  const utils = trpc.useUtils();
  const mine = trpc.complaints.mine.useQuery(undefined, { retry: false });
  const unreadQuery = trpc.messages.unreadByComplaint.useQuery(undefined, { refetchInterval: 6_000, retry: false });
  const unreadById = useMemo(() => new Map((unreadQuery.data ?? []).map(u => [u.complaintId, u.count])), [unreadQuery.data]);
  const own = trackedId ? mine.data?.find(c => c.consumerId === trackedId) : undefined;
  // Refresh every 15 s so the status moves on by itself while the student keeps the page open.
  const detail = trpc.complaints.detail.useQuery({ id: own?.id ?? 0 }, { enabled: !!own, retry: false, refetchInterval: 15_000 });
  const publicStatus = trpc.complaints.track.useQuery({ consumerId: trackedId ?? "" }, { enabled: !!trackedId && mine.isSuccess && !own, retry: false, refetchInterval: 15_000 });

  const track = (raw: string) => {
    const id = normalizeConsumerId(raw);
    if (!isConsumerId(id)) {
      setFormatError("A tracking number looks like CCMS-2026-123456.");
      return;
    }
    setFormatError("");
    setInput(id);
    setTrackedId(id);
    // Pressing Track again on the same number must pull the latest status, not reuse cached data.
    void utils.complaints.invalidate();
  };

  const complaint = detail.data?.complaint;
  const history = (detail.data?.history ?? []) as TrackHistory[];
  const pub = publicStatus.data;
  const status = complaint?.status ?? pub?.status;
  const loading = !!trackedId && (mine.isLoading || (!!own && detail.isLoading) || (!own && mine.isSuccess && publicStatus.isLoading));
  const notFound = !!trackedId && mine.isSuccess && !own && publicStatus.isSuccess && !pub;
  const failed = detail.error ?? publicStatus.error ?? mine.error;

  return (
    <>
      <SectionHeader eyebrow="Follow your complaint" title="Track a complaint" description="Enter your tracking number to see where your complaint is right now and what happened so far." />

      <form onSubmit={e => { e.preventDefault(); track(input); }} className="rounded-[17px] border border-[#dbe4f1] bg-white p-5 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
        <label htmlFor="tracking-number" className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.1em] text-[#6c7d9b]">Tracking number</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aabc4]" />
            <Input id="tracking-number" value={input} onChange={e => { setInput(e.target.value); setFormatError(""); }} placeholder="CCMS-2026-123456" className="h-11 pl-9 font-mono uppercase placeholder:normal-case" autoComplete="off" />
          </div>
          <Button type="submit" className="h-11 rounded-xl bg-[#174cb8] px-6 text-[12px] font-bold hover:bg-[#123d9a]">Track</Button>
        </div>
        {formatError && <p role="alert" className="mt-2 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" />{formatError}</p>}
        {!!mine.data?.length && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b9ab3]">Your complaints</span>
            {mine.data.slice(0, 6).map(c => (
              <button key={c.id} type="button" onClick={() => track(c.consumerId)} aria-label={unreadById.get(c.id) ? `${c.consumerId}, ${unreadById.get(c.id)} unread message${unreadById.get(c.id) === 1 ? "" : "s"}` : c.consumerId} className={cn("relative rounded-lg border px-3 py-2 font-mono text-[10px] font-bold transition sm:px-2.5 sm:py-1", trackedId === c.consumerId ? "border-[#174cb8] bg-[#174cb8] text-white" : "border-[#cbdaf3] bg-[#edf4ff] text-[#174cb8] hover:border-[#174cb8]")}>
                {c.consumerId}
                {!!unreadById.get(c.id) && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e5484d] px-1 text-[9px] font-bold text-white">{unreadById.get(c.id)}</span>}
              </button>
            ))}
          </div>
        )}
      </form>

      {!trackedId && !!unreadQuery.data?.length && (
        <div className="mt-4 space-y-2">
          {unreadQuery.data.map(u => {
            const c = mine.data?.find(x => x.id === u.complaintId);
            if (!c) return null;
            return (
              <button key={u.complaintId} type="button" onClick={() => track(c.consumerId)}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#f2b9c2] bg-[#fff0f2] px-4 py-3 text-left text-[12px] font-bold text-[#bb3043] hover:bg-[#ffe6ea]">
                <MessageSquareText className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{u.count} new {u.count === 1 ? "message" : "messages"} from staff on <span className="font-mono">{c.consumerId}</span></span>
                <span className="underline">Open</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {!trackedId && (
          <EmptyCard icon={<Search className="h-10 w-10" />} title="Enter a tracking number to begin">
            You got it when you submitted the complaint. It is also shown in My complaints.
            {!mine.isLoading && !mine.data?.length && <div className="mt-4"><Button onClick={onOpenSubmit} className="h-10 rounded-xl bg-[#174cb8] px-4 text-[11px] font-bold hover:bg-[#123d9a]"><Plus className="mr-2 h-4 w-4" />Submit a complaint</Button></div>}
          </EmptyCard>
        )}

        {loading && <div className="flex h-48 items-center justify-center rounded-[17px] border border-[#dbe4f1] bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#3971d7]" /></div>}

        {!loading && failed && !status && <QueryError message={failed.message} onRetry={() => { mine.refetch(); detail.refetch(); publicStatus.refetch(); }} />}

        {notFound && (
          <div role="alert" className="rounded-[17px] border border-[#f1c9c9] bg-[#fff6f6] p-8 text-center">
            <p className="text-sm font-bold text-[#a33a3a]">No complaint found for {trackedId}</p>
            <p className="mt-1 text-xs text-[#7788a5]">Check the number and try again.</p>
          </div>
        )}

        {!loading && status && trackedId && (
          <div className="space-y-5">
            {!!complaint && !!unreadById.get(complaint.id) && (
              <button type="button" onClick={() => document.getElementById("complaint-chat")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#f2b9c2] bg-[#fff0f2] px-4 py-3 text-left text-[12px] font-bold text-[#bb3043] hover:bg-[#ffe6ea]">
                <MessageSquareText className="h-4 w-4 shrink-0" />
                <span className="flex-1">{unreadById.get(complaint.id)} new {unreadById.get(complaint.id) === 1 ? "message" : "messages"} from staff on this complaint</span>
                <span className="underline">Read now</span>
              </button>
            )}
            <div className="rounded-[17px] border border-[#dbe4f1] bg-white p-6 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#8ba9e9]">Current status</p>
                  <div className="mt-2 flex items-center gap-3"><StatusBadge status={status} /><span className="text-[11px] text-[#8b9ab3]">Updated {format(new Date(complaint?.updatedAt ?? pub!.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span></div>
                </div>
                <span className="rounded-lg border border-[#cbdaf3] bg-[#edf4ff] px-2.5 py-1.5 font-mono text-[11px] font-bold text-[#174cb8]">{trackedId}</span>
              </div>
              {complaint && <h3 className="mt-4 text-[16px] font-extrabold text-[#0b255f]">{complaint.title}</h3>}
              <p className="mt-1 text-[12px] text-[#5d729a]">{FLOW_HINT[status]}</p>
              <div className="mt-8 px-2"><StatusFlow status={status} createdAt={complaint?.createdAt ?? pub!.createdAt} history={history} /></div>
              {complaint?.assignedAdminId && status !== "Withdrawn" && <p className="mt-6 rounded-lg bg-[#f3f7fd] px-3 py-2 text-[11px] font-bold text-[#274777]">A staff member has been assigned to your complaint.</p>}
              {!complaint && <p className="mt-6 rounded-lg bg-[#f3f7fd] px-3 py-2 text-[11px] text-[#5d729a]">This complaint was not filed from your account, so only its status is shown.</p>}
            </div>

            {complaint && (
              <div className="rounded-[17px] border border-[#dbe4f1] bg-white p-6 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[12px] font-extrabold uppercase tracking-[.1em] text-[#7788a5]">Activity</p>
                  <Link href={`/workspace/complaints/${complaint.id}`} className="tap-area flex items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">Full details <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </div>
                <ol className="relative ml-2 border-l-2 border-[#e5ebf3] pl-6">
                  {history.map((h, i) => {
                    const isNote = h.oldStatus === h.newStatus;
                    return (
                      <li key={h.id} className="relative mb-6 last:mb-0">
                        <span className={cn("absolute -left-[33px] top-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-white", i === 0 ? "bg-[#174cb8]" : isNote ? "bg-[#9aabc4]" : "bg-[#2aad75]")} />
                        <p className="text-[12px] font-bold text-[#18366f]">{isNote ? "Update" : h.oldStatus ? `${FLOW_LABEL[h.oldStatus] ?? h.oldStatus} → ${FLOW_LABEL[h.newStatus] ?? h.newStatus}` : FLOW_LABEL[h.newStatus] ?? h.newStatus}</p>
                        <p className="text-[10px] font-bold text-[#6b82ae]">{format(new Date(h.changedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                        {h.remarks && <p className="mt-1 text-[11px] leading-5 text-[#8291aa]">{h.remarks}</p>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {complaint && <ComplaintChat complaintId={complaint.id} viewer="student" closed={complaint.status === "Withdrawn"} />}
          </div>
        )}
      </div>
    </>
  );
}

function StudentOverview({ setSection }: { setSection: (section: string) => void }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: complaints } = trpc.complaints.mine.useQuery(undefined, { retry: false });
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}${user?.name ? `, ${user.name.split(/\s+/)[0]}` : ""}.`;
  const total = complaints?.length ?? 0;
  const inProgress = complaints?.filter(c => c.status === "In Progress").length ?? 0;
  const resolved = complaints?.filter(c => c.status === "Resolved").length ?? 0;

  return (
    <>
      <SectionHeader
        eyebrow={format(new Date(), "EEEE · MMMM d, yyyy")}
        title={greeting}
        description="Keep an eye on your open requests and stay informed as campus teams respond."
        action={<Button onClick={() => setSection("submit")} className="h-11 rounded-xl bg-[#174cb8] px-4 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]"><Plus className="mr-2 h-4 w-4" />New complaint</Button>}
      />
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard hideNoteOnPhone label={<>Total<span className="hidden sm:inline"> complaints</span></>} value={String(total).padStart(2, "0")} note="Since joining CCMS" icon={ClipboardList} tone="bg-[#edf3ff] text-[#2458c4]" accent="bg-[#2458c4]" />
        <StatCard hideNoteOnPhone label="In progress" value={String(inProgress).padStart(2, "0")} note={inProgress > 0 ? "Staff are working on these" : "No active complaints"} icon={Clock3} tone="bg-[#e9f7ff] text-[#1684b5]" accent="bg-[#1684b5]" />
        <StatCard hideNoteOnPhone label="Resolved" value={String(resolved).padStart(2, "0")} note={resolved > 0 ? "Resolved successfully" : "Awaiting resolution"} icon={Check} tone="bg-[#eafaf1] text-[#168052]" accent="bg-[#2aad75]" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 rounded-[17px] border border-[#dbe4f1] bg-white p-5 shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <div className="flex items-center justify-between">
            <div><p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Recent complaints</p><p className="mt-1 text-[11px] text-[#8b9ab3]">Your latest requests and current progress</p></div>
            <button type="button" onClick={() => setSection("my-complaints")} className="tap-area flex items-center gap-1 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]">View all <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-5 space-y-2">
            {complaints?.slice(0, 3).map((item, i) => (
              <ComplaintRow key={item.id} item={item} onClick={() => navigate(`/workspace/complaints/${item.id}`)} />
            ))}
            {!complaints?.length && (
              <div className="py-8 text-center text-[#8b9ab3]">No complaints yet. <button type="button" onClick={() => setSection("submit")} className="text-[#2458c4] hover:underline">Submit one</button></div>
            )}
          </div>
        </div>
        <div className="min-w-0 rounded-[17px] border border-[#dbe4f1] bg-[#f6f9ff] p-5 shadow-[0_6px_24px_rgba(28,69,137,.045)]">
          <div className="flex items-center justify-between"><div><p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Latest update</p><p className="mt-1 text-[11px] text-[#8b9ab3]">Most recent activity</p></div></div>
          <div className="mt-5 space-y-4">
            {complaints?.slice(0, 2).map((c) => (
              <TimelineDot key={c.id} color="bg-[#174cb8]" title={c.title} time={format(new Date(c.updatedAt), "MMM d, HH:mm")} detail={`Status: ${c.status}`} />
            ))}
            {!complaints?.length && <p className="text-[11px] text-[#8b9ab3]">No recent activity</p>}
          </div>
        </div>
      </div>
      <PrivacyNote />
    </>
  );
}

const formatDuration = (hours: number | null) => {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

function Reports() {
  const utils = trpc.useUtils();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const { data: summary, error, refetch } = trpc.staff.summary.useQuery({ tzOffsetMinutes }, { retry: false });
  const [exporting, setExporting] = useState(false);
  const exportAll = async () => {
    setExporting(true);
    try {
      const all = await utils.staff.list.fetch();
      downloadComplaintsCsv(all);
      toast.success(`Exported ${all.length} complaints`);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  };
  const weekMax = Math.max(1, ...(summary?.last7Days.map(d => d.count) ?? [0]));
  const withinThreeDays = summary && summary.resolvedMeasured > 0 ? Math.round((summary.resolvedWithin3Days / summary.resolvedMeasured) * 100) : null;

  const categoryItems = summary?.byCategory?.map((cat) => {
    const maxCount = summary?.byCategory ? Math.max(...summary.byCategory.map(c => c.count)) : 0;
    const width = maxCount > 0 && cat.count ? (cat.count / maxCount) * 100 : 0;
    return (
      <div key={cat.category} className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-[#5f7497]">{cat.category}</span>
          <span className="font-extrabold text-[#18366f]">{cat.count}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-[#edf1f7]">
          <div className="h-2 rounded-full bg-[#2458c4]" style={{ width: width + "%" }} />
        </div>
      </div>
    );
  });

  const statusItems = [
    { label: "Pending", count: summary?.pending ?? 0, color: "#336edb" },
    { label: "In Progress", count: summary?.inProgress ?? 0, color: "#1897cb" },
    { label: "Resolved", count: summary?.resolved ?? 0, color: "#27a76c" },
    { label: "Withdrawn", count: summary?.withdrawn ?? 0, color: "#bb3043" },
  ].map((s) => {
    const total = summary?.total ?? 0;
    const width = total > 0 ? (s.count / total) * 100 : 0;
    return (
      <div key={s.label} className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-[#5f7497]">{s.label}</span>
          <span className="font-extrabold text-[#18366f]">{s.count}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-[#edf1f7]">
          <div className="h-2 rounded-full" style={{ width: width + "%", backgroundColor: s.color }} />
        </div>
      </div>
    );
  });

  return (
    <>
      <SectionHeader
        eyebrow="Institutional intelligence"
        title="Reports & trends"
        description="Understand the issues shaping campus experience and the teams delivering resolution."
        action={<Button onClick={exportAll} disabled={exporting} variant="outline" className="h-10 rounded-xl border-[#cbd8ed] bg-white px-4 text-[11px] font-bold text-[#31588f]"><FileText className="mr-2 h-4 w-4" />{exporting ? "Exporting…" : "Export CSV"}</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Avg. resolution time" value={formatDuration(summary?.avgResolutionHours ?? null)} note={summary?.resolvedMeasured ? `From ${summary.resolvedMeasured} resolved complaints` : "No resolved complaints yet"} icon={Target} tone="bg-[#edfbf3] text-[#168052]" accent="bg-[#2aad75]" />
        <StatCard label="Resolved within 3 days" value={withinThreeDays === null ? "—" : `${withinThreeDays}%`} note={summary?.resolvedMeasured ? `${summary.resolvedWithin3Days} of ${summary.resolvedMeasured} resolved complaints` : "No resolved complaints yet"} icon={ShieldCheck} tone="bg-[#edf3ff] text-[#2458c4]" accent="bg-[#2458c4]" />
        <StatCard label="Student satisfaction" value={summary?.avgRating == null ? "—" : `${summary.avgRating.toFixed(1)}/5`} note={summary?.feedbackCount ? `From ${summary.feedbackCount} feedback ${summary.feedbackCount === 1 ? "response" : "responses"}` : "No feedback yet"} icon={Sparkles} tone="bg-[#fff4e6] text-[#ba6915]" accent="bg-[#e28d32]" />
      </div>
      {error && <div className="mt-6"><QueryError message={error.message} onRetry={() => refetch()} /></div>}
      <Card className="mt-6 border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
        <CardContent className="p-5">
          <p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Complaints filed, last 7 days</p>
          <p className="mt-1 text-[11px] text-[#8b9ab3]">{summary ? `${summary.last7Days.reduce((sum, d) => sum + d.count, 0)} in total` : "Loading…"}</p>
          <div className="mt-5 flex h-36 items-end gap-3" role="img" aria-label="Bar chart of complaints filed per day for the last 7 days">
            {summary?.last7Days.map(day => (
              <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-extrabold text-[#18366f]">{day.count}</span>
                <div className="w-full rounded-t-md bg-[#2458c4]" style={{ height: `${Math.max(day.count > 0 ? 6 : 2, (day.count / weekMax) * 96)}px`, opacity: day.count ? 1 : 0.25 }} />
                <span className="text-[10px] font-bold text-[#8b9ab3]">{format(new Date(`${day.date}T12:00:00`), "EEE d")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <CardContent className="p-5">
            <p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Complaints by category</p>
            <p className="mt-1 text-[11px] text-[#8b9ab3]">Live data from database</p>
            <div className="mt-6 space-y-4">
              {categoryItems}
              {!summary?.byCategory?.length && <p className="text-[11px] text-[#8b9ab3]">No category data available</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
          <CardContent className="p-5">
            <p className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Status distribution</p>
            <p className="mt-1 text-[11px] text-[#8b9ab3]">Current complaint statuses</p>
            <div className="mt-6 space-y-4">
              {statusItems}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function Workspace() {
  const [section, setSection] = useState("overview");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [triagePreset, setTriagePreset] = useState<TriagePreset | undefined>();
  // Dashboard shortcuts open a section with filters already applied; picking a section from the menu starts clean.
  const goTo = (id: string, preset?: TriagePreset) => { setTriagePreset(id === "inbox" ? preset : undefined); setSection(id); };
  const { user, logout } = useAuth();

  const mode: "student" | "staff" = user?.role === "admin" ? "staff" : "student";

  // Switching role (e.g. logging in as someone else) starts from the overview.
  useEffect(() => {
    setSection("overview");
  }, [mode]);


  const content = mode === "student" ? (
    section === "submit" ? <SubmitComplaint onDone={() => setSection("my-complaints")} onTrack={id => { setTrackId(id); setSection("track"); }} /> :
    section === "my-complaints" ? <StudentComplaints setSection={setSection} /> :
    section === "track" ? <TrackComplaint key={trackId ?? "none"} initialId={trackId ?? undefined} onOpenSubmit={() => setSection("submit")} /> :
    section === "notifications" ? <Notifications userId={user?.id ?? 0} /> :
    <StudentOverview setSection={setSection} />
  ) : (
    section === "messages" ? <StaffMessages /> :
    section === "inbox" ? <TriageInbox key={JSON.stringify(triagePreset ?? {})} preset={triagePreset} /> :
    section === "reports" ? <Reports /> :
    section === "notifications" ? <Notifications userId={user?.id ?? 0} /> :
    <StaffOverview onGo={goTo} />
  );

  return (
    <>
      <Shell mode={mode} section={section} setSection={id => goTo(id)} logout={logout} userName={user?.name ?? ""} userEmail={user?.email ?? ""}><Suspense fallback={<ContentLoader />}>{content}</Suspense></Shell>
      <AssistantWidget role={mode} userName={user?.name} userId={user?.id} />
    </>
  );
}