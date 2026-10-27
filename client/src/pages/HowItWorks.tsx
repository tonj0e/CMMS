import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronDown, Clock3, Download, EyeOff, FilePlus2, History, Inbox, LayoutDashboard,
  Lock, MessageSquareText, Paperclip, Search, ShieldCheck, Smartphone, Star, Ticket, UserCheck, UserPlus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PublicLayout from "@/components/PublicLayout";

type Role = "student" | "staff";

// ---------------------------------------------------------------- little screen mock-ups (pure markup, no images to load)

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white shadow-[0_14px_40px_rgba(16,41,102,.12)]" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b border-[#e5ebf3] bg-[#f7f9fd] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#f2b9c2]" /><span className="h-2 w-2 rounded-full bg-[#f5d2a4]" /><span className="h-2 w-2 rounded-full bg-[#bce5d4]" />
        <span className="ml-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#8b9ab3]">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const Line = ({ w = "w-full", tone = "bg-[#e5ebf3]" }: { w?: string; tone?: string }) => <div className={cn("h-2 rounded-full", w, tone)} />;
const Chip = ({ children, tone }: { children: React.ReactNode; tone: string }) => <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold", tone)}>{children}</span>;

function RegisterMock() {
  return (
    <Frame title="Create account">
      <div className="space-y-2.5">
        {["Full name", "Student ID", "Admission number", "Email address", "Password"].map(label => (
          <div key={label}><p className="mb-1 text-[10px] font-bold text-[#5d729a]">{label}</p><div className="flex h-8 items-center rounded-lg border border-[#d7e2f4] bg-[#f9fbfe] px-3"><Line w="w-1/2" tone="bg-[#d7e2f4]" /></div></div>
        ))}
        <div className="flex h-9 items-center justify-center rounded-xl bg-[#174cb8] text-[11px] font-bold text-white">Create Student Account</div>
      </div>
    </Frame>
  );
}

function SubmitMock() {
  return (
    <Frame title="Submit a complaint">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{["Classroom", "Hostel", "IT", "Cleanliness"].map((c, i) => <Chip key={c} tone={i === 1 ? "bg-[#174cb8] text-white" : "bg-[#edf3ff] text-[#2458c4]"}>{c}</Chip>)}</div>
        <div className="space-y-1.5 rounded-lg border border-[#d7e2f4] p-3"><Line w="w-2/3" tone="bg-[#c9d7ee]" /><Line /><Line w="w-5/6" /></div>
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#9cb7e9] bg-[#f3f7fd] px-3 py-2 text-[10px] font-bold text-[#2458c4]"><Paperclip className="h-3.5 w-3.5" />photo.jpg attached</div>
        <div className="flex items-center gap-2 rounded-lg bg-[#eafaf1] px-3 py-2 text-[10px] font-bold text-[#168052]"><ShieldCheck className="h-3.5 w-3.5" />Content check passed: respectful language</div>
        <div className="flex h-9 items-center justify-center rounded-xl bg-[#174cb8] text-[11px] font-bold text-white">Submit complaint</div>
      </div>
    </Frame>
  );
}

function TicketMock() {
  return (
    <Frame title="Complaint submitted">
      <div className="py-3 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-[#27a76c]" />
        <p className="mt-2 text-[13px] font-extrabold text-[#0b255f]">Complaint submitted</p>
        <p className="mt-1 text-[10px] text-[#8b9ab3]">Save your tracking number</p>
        <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-lg border border-[#cbdaf3] bg-[#edf4ff] px-4 py-2.5 font-mono text-[15px] font-bold tracking-wide text-[#174cb8]">CCMS-2026-158093</div>
        <p className="mt-3 text-[10px] text-[#8b9ab3]">Unique to this complaint. Works without logging in.</p>
      </div>
    </Frame>
  );
}

function StatusMock() {
  const steps = [["Submitted", "done"], ["In progress", "current"], ["Resolved", "todo"]] as const;
  return (
    <Frame title="Track a complaint">
      <div className="flex items-center gap-2"><Chip tone="bg-[#e9f7ff] text-[#14729c]">In Progress</Chip><span className="font-mono text-[10px] font-bold text-[#174cb8]">CCMS-2026-158093</span></div>
      <p className="mt-2 text-[12px] font-extrabold text-[#0b255f]">No hot water in hostel block C</p>
      <div className="mt-4 flex items-start">
        {steps.map(([label, state], i) => (
          <div key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cn("absolute right-1/2 top-[13px] h-[3px] w-full", state === "todo" ? "bg-[#dbe4f1]" : "bg-[#2aad75]")} />}
            <span className={cn("relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-[3px] text-[10px] font-black", state === "done" && "border-[#2aad75] bg-[#2aad75] text-white", state === "current" && "border-[#174cb8] bg-white text-[#174cb8] shadow-[0_0_0_5px_rgba(23,76,184,.15)]", state === "todo" && "border-[#dbe4f1] bg-white text-[#b0bfd4]")}>{state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className={cn("mt-1.5 text-[10px] font-extrabold", state === "todo" ? "text-[#9aabc4]" : "text-[#18366f]")}>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-l-2 border-[#e5ebf3] pl-3">
        <div><p className="text-[10px] font-bold text-[#18366f]">Submitted → In progress</p><p className="text-[10px] text-[#8b9ab3]">“Plumber assigned” · 5 min ago</p></div>
        <div><p className="text-[10px] font-bold text-[#18366f]">Submitted</p><p className="text-[10px] text-[#8b9ab3]">Complaint submitted</p></div>
      </div>
    </Frame>
  );
}

function ChatMock() {
  return (
    <Frame title="Messages">
      <div className="space-y-2.5">
        <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#dbe4f1] bg-white px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7788a5]">Staff</p><p className="text-[11px] text-[#18366f]">A plumber is on the way. Can you share the room number?</p></div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#174cb8] px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#bcd2ff]">You</p><p className="text-[11px] text-white">Room C-204, thank you!</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-[#f2b9c2] bg-[#fff0f2] px-3 py-2 text-[10px] font-bold text-[#bb3043]"><Bell className="h-3.5 w-3.5" />1 new message from staff<span className="ml-auto rounded-full bg-[#e5484d] px-1.5 text-white">1</span></div>
      </div>
    </Frame>
  );
}

function FeedbackMock() {
  return (
    <Frame title="Resolved">
      <div className="py-2 text-center">
        <Chip tone="bg-[#edfbf3] text-[#18794e]">Resolved</Chip>
        <p className="mt-2 text-[12px] font-extrabold text-[#0b255f]">How did we do?</p>
        <div className="mt-2 flex justify-center gap-1">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={cn("h-5 w-5", n <= 4 ? "fill-[#f5b942] text-[#f5b942]" : "text-[#d7e2f4]")} />)}</div>
        <p className="mt-2 text-[10px] text-[#8b9ab3]">Your rating goes into the staff satisfaction report.</p>
      </div>
    </Frame>
  );
}

function DashboardMock() {
  return (
    <Frame title="Command center">
      <div className="grid grid-cols-4 gap-1.5">{[["98", "Total"], ["58", "Triage"], ["19", "Active"], ["12", "Done"]].map(([v, l]) => <div key={l} className="rounded-lg border border-[#e5ebf3] p-2 text-center"><p className="text-[14px] font-extrabold text-[#102c6b]">{v}</p><p className="text-[8px] font-bold uppercase text-[#8b9ab3]">{l}</p></div>)}</div>
      <div className="mt-3 space-y-1.5">
        {[["Waiting 3+ days", "2", "bg-[#fff4e6] text-[#ba6915]"], ["Serious and open", "34", "bg-[#fff0f2] text-[#bb3043]"], ["Waiting for a reply", "8", "bg-[#f3efff] text-[#7653c4]"]].map(([l, n, t]) => <div key={l} className="flex items-center gap-2 rounded-lg border border-[#e5ebf3] px-2.5 py-1.5"><span className={cn("h-5 w-5 rounded-md", t)} /><span className="flex-1 text-[10px] font-bold text-[#18366f]">{l}</span><span className="text-[12px] font-extrabold text-[#18366f]">{n}</span></div>)}
      </div>
      <div className="mt-3 flex h-12 items-end gap-1.5">{[6, 0, 0, 3, 8, 5, 12].map((h, i) => <div key={i} className="flex-1 rounded-t bg-[#2458c4]" style={{ height: `${Math.max(2, h * 4)}px`, opacity: h ? 1 : 0.25 }} />)}</div>
    </Frame>
  );
}

function TriageMock() {
  return (
    <Frame title="Triage inbox">
      <div className="flex gap-1 rounded-md bg-[#f2f5fa] p-1">{["All", "Open", "Pending", "Active"].map((t, i) => <span key={t} className={cn("flex-1 rounded px-1 py-1 text-center text-[9px] font-bold", i === 1 ? "bg-white text-[#2458c4]" : "text-[#8293ad]")}>{t}</span>)}</div>
      <div className="mt-2.5 space-y-1.5">
        {[["Hot water missing", "Critical", "bg-[#fff0f2] text-[#bb3043]"], ["Wifi dropping in lab 3", "Medium", "bg-[#f5f0ff] text-[#6e47b8]"]].map(([t, p, tone]) => <div key={t} className="flex items-center gap-2 rounded-lg border border-[#e5ebf3] px-2.5 py-2"><div className="flex-1"><p className="text-[10px] font-bold text-[#18366f]">{t}</p><p className="text-[9px] text-[#8b9ab3]">Unassigned · 5 min ago</p></div><Chip tone={tone}>{p}</Chip></div>)}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#1684b5] py-2 text-center text-[10px] font-bold text-white">Start work</div><div className="rounded-lg bg-[#168052] py-2 text-center text-[10px] font-bold text-white">Resolve</div></div>
    </Frame>
  );
}

function StaffChatMock() {
  return (
    <Frame title="Messages">
      <div className="flex gap-1 rounded-md bg-[#f2f5fa] p-1"><span className="flex-1 rounded bg-white py-1 text-center text-[9px] font-bold text-[#2458c4]">To reply <span className="ml-1 rounded-full bg-[#e5484d] px-1 text-white">3</span></span><span className="flex-1 py-1 text-center text-[9px] font-bold text-[#8293ad]">Chats</span><span className="flex-1 py-1 text-center text-[9px] font-bold text-[#8293ad]">All</span></div>
      <div className="mt-2.5 rounded-lg border border-[#e5ebf3] bg-[#f3f7fd] p-2.5"><p className="text-[10px] font-extrabold text-[#18366f]">Student ID CS/2021/045</p><p className="text-[9px] text-[#8b9ab3]">Anonymous complaints show no identity at all.</p></div>
      <div className="mt-2.5 space-y-2"><div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#dbe4f1] px-3 py-2 text-[10px] text-[#18366f]">Is anyone looking at this?</div><div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#174cb8] px-3 py-2 text-[10px] text-white">Yes, a plumber visits today.</div></div>
    </Frame>
  );
}

function AuditMock() {
  return (
    <Frame title="Audit trail">
      <div className="space-y-3 border-l-2 border-[#e5ebf3] pl-3">
        {[["Priya moved to Resolved", "“Pipe replaced”", "2 min ago", "bg-[#27a76c]"], ["Priya moved to In progress", "“Plumber assigned”", "1 hr ago", "bg-[#174cb8]"], ["Student filed CCMS-2026-158093", "Complaint submitted", "1 hr ago", "bg-[#9aabc4]"]].map(([a, b, c, dot]) => (
          <div key={a} className="relative"><span className={cn("absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white", dot)} /><p className="text-[10px] font-bold text-[#18366f]">{a}</p><p className="text-[10px] text-[#8b9ab3]">{b} · {c}</p></div>
        ))}
      </div>
    </Frame>
  );
}

function ReportsMock() {
  return (
    <Frame title="Reports">
      <div className="grid grid-cols-3 gap-1.5">{[["1.4d", "Time to resolve"], ["92%", "Within 3 days"], ["4.6/5", "Satisfaction"]].map(([v, l]) => <div key={l} className="rounded-lg border border-[#e5ebf3] p-2 text-center"><p className="text-[13px] font-extrabold text-[#102c6b]">{v}</p><p className="text-[8px] font-bold uppercase text-[#8b9ab3]">{l}</p></div>)}</div>
      <div className="mt-3 space-y-2">{[["Hostel", "w-5/6"], ["IT", "w-3/5"], ["Classroom", "w-2/5"]].map(([l, w]) => <div key={l}><p className="mb-1 text-[9px] font-bold text-[#5f7497]">{l}</p><div className="h-1.5 rounded-full bg-[#edf1f7]"><div className={cn("h-1.5 rounded-full bg-[#2458c4]", w)} /></div></div>)}</div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[#cbd8ed] py-2 text-[10px] font-bold text-[#31588f]"><Download className="h-3.5 w-3.5" />Export CSV</div>
    </Frame>
  );
}

function StaffAccountMock() {
  return (
    <Frame title="Staff sign-up">
      <div className="space-y-2.5 py-1">
        <div className="flex items-center gap-2.5 rounded-lg border border-[#e5ebf3] p-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe6ff] text-[10px] font-extrabold text-[#174cb8]">PS</span><div className="flex-1"><p className="text-[11px] font-bold text-[#18366f]">Priya Staff</p><p className="text-[9px] text-[#8b9ab3]">Staff / Administrator</p></div><Chip tone="bg-[#edf3ff] text-[#2458c4]">Staff</Chip></div>
        <p className="rounded-lg bg-[#f3f7fd] p-2.5 text-[10px] leading-4 text-[#5d729a]">Name, email and password, plus the staff access code from an administrator.</p>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- content

type Step = { icon: React.ComponentType<{ className?: string }>; title: string; text: string; points: string[]; mock: React.ReactNode };

const STUDENT_STEPS: Step[] = [
  { icon: UserPlus, title: "Create your account", text: "Register once with your college details. It takes about a minute.", points: ["Full name, Student ID, Admission number, email and a password.", "Your Student ID and Admission number are checked so nobody can register twice.", "Password needs 8+ characters with upper case, lower case and a number."], mock: <RegisterMock /> },
  { icon: FilePlus2, title: "Submit a complaint", text: "Describe what is wrong and where. Pick how serious it is.", points: ["Choose a category, write a title and description, add the location and priority.", "Attach a JPG, PNG or PDF (up to 10 MB) if it helps.", "Choose anonymous if you want staff not to see who you are.", "Respectful language only: abusive words (English, Malayalam or Manglish) are blocked before sending.", "Your text is saved as you type, so a refresh never loses it."], mock: <SubmitMock /> },
  { icon: Ticket, title: "Get your tracking number", text: "The moment you submit, you receive a number like CCMS-2026-158093.", points: ["It is unique to your complaint. Copy it with one tap.", "You can also find it any time under My complaints.", "Anyone with the number can check the status from the home page, even without logging in."], mock: <TicketMock /> },
  { icon: Search, title: "Track progress", text: "Open Track complaint and enter or pick your number to see exactly where it is.", points: ["A progress bar shows Submitted → In progress → Resolved, with the time of each step.", "A timeline lists every change and the remark staff left.", "The page refreshes by itself, so you do not need to reload."], mock: <StatusMock /> },
  { icon: MessageSquareText, title: "Chat with staff", text: "If staff need more detail they message you, and you can message them.", points: ["Replies appear in the Messages box under your complaint.", "You are told by a red number, a banner and a pop-up, so nothing is missed.", "Seen and Sent ticks show if your message was read."], mock: <ChatMock /> },
  { icon: Star, title: "Close the loop", text: "When staff resolve the complaint you can rate how it went.", points: ["Leave a 1–5 rating and an optional comment.", "Changed your mind? You can withdraw a complaint while it is still Pending.", "Reopened by staff if the problem is not really fixed."], mock: <FeedbackMock /> },
];

const STAFF_STEPS: Step[] = [
  { icon: UserCheck, title: "Create your staff account", text: "Staff register with just a name, email and password, plus the staff access code from an administrator.", points: ["Open Create account, choose the Staff tab. No Student ID or Admission number is needed.", "The access code is what keeps students from creating staff accounts.", "Then sign in on the same login page and you land on the Command center."], mock: <StaffAccountMock /> },
  { icon: LayoutDashboard, title: "Start at the Command center", text: "One screen shows what needs you right now.", points: ["Needs your attention: complaints waiting 3+ days, serious and open, unassigned, and students waiting for a reply.", "Click any of them to open exactly those complaints.", "Charts for the last 7 days, status, priority, categories and who has how much work."], mock: <DashboardMock /> },
  { icon: Inbox, title: "Work through the Triage inbox", text: "Filter, sort and move complaints forward.", points: ["Tabs for All, Open, Pending, Active, Resolved, Withdrawn, plus priority and sort options.", "Start work or Resolve in one click, or choose a status and add a remark.", "Assign a complaint to a colleague so nothing has no owner."], mock: <TriageMock /> },
  { icon: MessageSquareText, title: "Answer students in Messages", text: "See who is waiting and reply in the same place.", points: ["The To reply tab lists students waiting for an answer.", "You see the Student ID only. Anonymous complaints show no identity at all.", "Replies notify the student immediately."], mock: <StaffChatMock /> },
  { icon: History, title: "Every change is recorded", text: "Status moves are checked and logged.", points: ["Only valid moves are allowed (for example a withdrawn complaint stays closed).", "Each change keeps who did it, when, and the remark.", "Students see the remarks on their tracking page."], mock: <AuditMock /> },
  { icon: BarChart3, title: "Report with real numbers", text: "Reports are calculated from real resolutions and feedback.", points: ["Average time to resolve, share resolved within 3 days, satisfaction rating.", "Last 7 days, categories and priorities.", "Export any list to CSV for meetings."], mock: <ReportsMock /> },
];

const LIFECYCLE = [
  { label: "Submitted", sub: "Pending", tone: "border-[#c6d6ff] bg-[#eef3ff] text-[#204eb7]", note: "Waiting for staff" },
  { label: "In progress", sub: "Being worked on", tone: "border-[#b8dff5] bg-[#e9f7ff] text-[#14729c]", note: "Staff updates and chats" },
  { label: "Resolved", sub: "Fixed", tone: "border-[#bce5d4] bg-[#edfbf3] text-[#18794e]", note: "Rate the result" },
];

const FAQ: [string, string][] = [
  ["Do I need an account to follow my complaint?", "To see the full history and chat, yes. But anyone with the tracking number can check the current status from the home page tracker without logging in."],
  ["Who can see my name?", "Staff only see your Student ID, never your name or email. If you choose anonymous, staff see no identity at all, and the chat keeps it that way. The Privacy page shows exactly who sees what."],
  ["What happens if I use bad language?", "The form stops you before you send. Abusive words in English, Malayalam and Manglish are blocked, and the check runs again on the server, so a complaint with abusive language can not be filed."],
  ["Can I withdraw or change a complaint?", "You can withdraw it while it is still Pending. After staff start work they manage the status, and you can keep talking to them in Messages."],
  ["How will I know about updates?", "A red number on the bell and menu, a pop-up when something new arrives, a banner on the Track page, and the notification list. You can switch the pop-ups off in Settings."],
  ["I lost my tracking number.", "Log in and open My complaints. Every complaint you filed is listed with its number."],
  ["What can I attach?", "JPG, PNG or PDF files up to 10 MB each, up to 10 per complaint. Only you and staff can open them."],
  ["Does it work on a phone?", "Yes. Every page is built for phones as well as computers, and there is a dark mode in the menu."],
];

// ---------------------------------------------------------------- page

export default function HowItWorks() {
  const [role, setRole] = useState<Role>("student");
  const steps = role === "student" ? STUDENT_STEPS : STAFF_STEPS;

  return (
    <PublicLayout>

      <section className="blueprint-grid bg-[#061b56] text-white">
        <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9fc4ff]">The guide</p>
          <h1 className="mt-3 max-w-[760px] text-[34px] font-extrabold leading-[1.05] tracking-[-.05em] sm:text-[52px]">How CCMS works, from first complaint to resolution.</h1>
          <p className="mt-4 max-w-[620px] text-[14px] leading-7 text-[#b9ccef]">A short, honest walk-through of what happens at every step: what you do, what the college sees, and how you stay informed.</p>
          <div className="mt-8 inline-flex rounded-2xl border border-white/15 bg-white/[.07] p-1" role="tablist" aria-label="Choose a guide">
            {([["student", "I am a student"], ["staff", "I am staff"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={role === id} onClick={() => setRole(id)}
                className={cn("rounded-xl px-4 py-2.5 text-[12px] font-bold transition sm:px-5", role === id ? "bg-white text-[#174cb8] shadow" : "text-white/75 hover:text-white")}>{label}</button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-[#9fc4ff]">
            <a href="#steps" className="tap-area hover:text-white">Step by step</a><a href="#lifecycle" className="tap-area hover:text-white">Complaint lifecycle</a><Link href="/privacy" className="tap-area hover:text-white">Privacy</Link><a href="#faq" className="tap-area hover:text-white">Questions</a>
          </div>
        </div>
      </section>

      <section id="steps" className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-[640px]">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">{role === "student" ? "For students" : "For staff"}</p>
          <h2 className="mt-3 text-[28px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">{role === "student" ? "Six steps, and you are always in the loop." : "Six steps from a full inbox to a closed case."}</h2>
        </div>
        <ol className="mt-10 space-y-14 sm:space-y-20">
          {steps.map((step, i) => (
            <li key={step.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              <div className={cn(i % 2 === 1 && "md:order-2")}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#174cb8] text-white shadow-[0_8px_20px_rgba(23,76,184,.25)]"><step.icon className="h-5 w-5" /></span>
                  <span className="text-[11px] font-black uppercase tracking-[.2em] text-[#8ba9e9]">Step {String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-[22px] font-extrabold tracking-[-.04em] text-[#0e2b68] sm:text-[26px]">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#5d729a]">{step.text}</p>
                <ul className="mt-4 space-y-2.5">
                  {step.points.map(point => <li key={point} className="flex gap-2.5 text-[13px] leading-5 text-[#3e5578]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#27a76c]" /><span>{point}</span></li>)}
                </ul>
              </div>
              <div className={cn("mx-auto w-full max-w-[420px]", i % 2 === 1 && "md:order-1")}>{step.mock}</div>
            </li>
          ))}
        </ol>
      </section>

      <section id="lifecycle" className="bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">Status</p>
          <h2 className="mt-3 text-[28px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">The life of a complaint.</h2>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#5d729a]">Every complaint is in exactly one of four states, and it only moves in ways that make sense.</p>
          <div className="mt-10 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            {LIFECYCLE.map((item, i) => (
              <div key={item.label} className="flex flex-1 flex-col items-stretch gap-3 md:flex-row md:items-center">
                <div className={cn("flex-1 rounded-2xl border p-5", item.tone)}>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] opacity-70">{item.sub}</p>
                  <p className="mt-1 text-[20px] font-extrabold tracking-[-.03em]">{item.label}</p>
                  <p className="mt-1 text-[12px] opacity-80">{item.note}</p>
                </div>
                {i < LIFECYCLE.length - 1 && <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-[#9aabc4] md:rotate-0" />}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-[#f2b9c2] bg-[#fff0f2] p-4"><X className="mt-0.5 h-5 w-5 shrink-0 text-[#bb3043]" /><div><p className="text-[13px] font-extrabold text-[#bb3043]">Withdrawn</p><p className="mt-0.5 text-[12px] leading-5 text-[#8a4a55]">A student can withdraw while a complaint is Pending. A withdrawn complaint is closed for good, and no more messages can be sent.</p></div></div>
            <div className="flex gap-3 rounded-2xl border border-[#cbdaf3] bg-[#f3f7fd] p-4"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#2458c4]" /><div><p className="text-[13px] font-extrabold text-[#18366f]">Reopening</p><p className="mt-0.5 text-[12px] leading-5 text-[#5d729a]">A resolved complaint can be reopened to In progress if the problem comes back. Staff can also move In progress back to Pending.</p></div></div>
          </div>
        </div>
      </section>

      <section id="privacy" className="bg-[#071e5c] text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9fc4ff]">Privacy and fairness</p>
          <h2 className="mt-3 max-w-[640px] text-[28px] font-extrabold tracking-[-.05em] sm:text-[34px]">Built for conversations that need care.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: EyeOff, title: "Anonymous on request", text: "Choose anonymous and staff see no identity, not even in the chat or the activity feed." },
              { icon: Lock, title: "Student ID only", text: "Staff never see your name or email. Only your Student ID, so they can follow up properly." },
              { icon: ShieldCheck, title: "Respectful by design", text: "Abusive language is blocked before a complaint or message is sent, in English, Malayalam and Manglish." },
              { icon: History, title: "Nothing disappears", text: "Every status change and remark is recorded with who did it and when." },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-white/15 bg-white/[.06] p-5"><item.icon className="h-5 w-5 text-[#9fc4ff]" /><p className="mt-3 text-[13px] font-bold">{item.title}</p><p className="mt-1.5 text-[12px] leading-5 text-[#99b2e4]">{item.text}</p></div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[#b8c9ec]"><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Works on phones</span><span className="flex items-center gap-2"><Bell className="h-4 w-4" />Live notifications</span></div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">Questions</p>
        <h2 className="mt-3 text-[28px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">Things people ask.</h2>
        <div className="mt-8 divide-y divide-[#e5ebf3] overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14px] font-bold text-[#18366f] hover:bg-[#f7faff] [&::-webkit-details-marker]:hidden">{q}<ChevronDown className="h-4 w-4 shrink-0 text-[#8b9ab3] transition group-open:rotate-180" /></summary>
              <p className="px-5 pb-5 text-[13px] leading-6 text-[#5d729a]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#061b56] text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div><h2 className="text-[26px] font-extrabold tracking-[-.045em] sm:text-[32px]">Ready when you are.</h2><p className="mt-2 text-[13px] text-[#b9ccef]">Create an account to file a complaint, or check one with its tracking number.</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-[12px] font-extrabold text-[#174cb8] hover:bg-[#eef4ff]">Create account <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <Link href="/#track" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/[.06] px-6 text-[12px] font-bold hover:bg-white/10">Track a complaint <Search className="ml-2 h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
