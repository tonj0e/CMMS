import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, EyeOff, FileLock2, History, KeyRound, Lock, Minus, ShieldCheck, UserRound, X } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- what each audience can see (mirrors how the system really behaves)

type Cell = { see: "yes" | "no" | "partial"; note?: string };
const yes = (note?: string): Cell => ({ see: "yes", note });
const no = (note?: string): Cell => ({ see: "no", note });
const partial = (note: string): Cell => ({ see: "partial", note });

const AUDIENCES = [
  { id: "you", label: "You", sub: "The student who filed it" },
  { id: "staff", label: "Staff", sub: "On a normal complaint" },
  { id: "anon", label: "Staff", sub: "On an anonymous complaint" },
  { id: "public", label: "Anyone", sub: "With only the tracking number" },
] as const;
type AudienceId = (typeof AUDIENCES)[number]["id"];

const ROWS: { label: string; cells: Record<AudienceId, Cell> }[] = [
  { label: "Your name", cells: { you: yes(), staff: no("Never shown"), anon: no("Never shown"), public: no() } },
  { label: "Your email", cells: { you: yes(), staff: no("Never shown"), anon: no("Never shown"), public: no() } },
  { label: "Admission number", cells: { you: yes(), staff: no("Never shown"), anon: no("Never shown"), public: no() } },
  { label: "Student ID", cells: { you: yes(), staff: yes("Only this, to follow up"), anon: no("Hidden"), public: no() } },
  { label: "Complaint text and files", cells: { you: yes(), staff: yes(), anon: yes(), public: no("Not shown") } },
  { label: "Chat messages", cells: { you: yes(), staff: yes("Labelled “Student”"), anon: yes("Labelled “Student”"), public: no() } },
  { label: "Status and history", cells: { you: yes(), staff: yes(), anon: yes(), public: partial("Status and dates only") } },
];

function Mark({ cell }: { cell: Cell }) {
  const tone = cell.see === "yes" ? "bg-[#eafaf1] text-[#168052]" : cell.see === "partial" ? "bg-[#fff4e6] text-[#ba6915]" : "bg-[#fff0f2] text-[#bb3043]";
  const Icon = cell.see === "yes" ? Check : cell.see === "partial" ? Minus : X;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", tone)}><Icon className="h-3.5 w-3.5" /></span>
      {cell.note && <span className="text-[11px] leading-tight text-[#5d729a]">{cell.note}</span>}
    </span>
  );
}

function Matrix() {
  const [audience, setAudience] = useState<AudienceId>("staff");
  const current = AUDIENCES.find(a => a.id === audience)!;
  return (
    <>
      {/* Phones: pick who is looking, then read one short list. */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Who is looking">
          {AUDIENCES.map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={audience === a.id} onClick={() => setAudience(a.id)}
              className={cn("rounded-xl border px-3 py-3 text-left transition", audience === a.id ? "border-[#174cb8] bg-[#174cb8] text-white" : "border-[#cbdaf3] bg-white text-[#31588f]")}>
              <span className="block text-[13px] font-extrabold">{a.label}</span>
              <span className={cn("block text-[11px] leading-tight", audience === a.id ? "text-white/75" : "text-[#8b9ab3]")}>{a.sub}</span>
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-[#edf1f6] overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white" aria-label={`What ${current.label} can see: ${current.sub}`}>
          {ROWS.map(row => (
            <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <span className="text-[13px] font-bold text-[#18366f]">{row.label}</span>
              <Mark cell={row.cells[audience]} />
            </li>
          ))}
        </ul>
      </div>

      {/* Larger screens: the whole grid at once. */}
      <div className="hidden overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e5ebf3] bg-[#f7f9fd]">
              <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[.14em] text-[#8ba9e9]">What</th>
              {AUDIENCES.map(a => <th key={a.id} className="px-4 py-4"><span className="block text-[13px] font-extrabold text-[#18366f]">{a.label}</span><span className="block text-[11px] font-medium text-[#8b9ab3]">{a.sub}</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f6]">
            {ROWS.map(row => (
              <tr key={row.label}>
                <th scope="row" className="px-5 py-3.5 text-[13px] font-bold text-[#18366f]">{row.label}</th>
                {AUDIENCES.map(a => <td key={a.id} className="px-4 py-3.5"><Mark cell={row.cells[a.id]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#8b9ab3]">
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#168052]" />can see</span>
        <span className="flex items-center gap-1.5"><Minus className="h-3.5 w-3.5 text-[#ba6915]" />some of it</span>
        <span className="flex items-center gap-1.5"><X className="h-3.5 w-3.5 text-[#bb3043]" />cannot see</span>
      </p>
    </>
  );
}

function StaffView({ title, student, note }: { title: string; student: string; note: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white shadow-[0_10px_30px_rgba(16,41,102,.08)]" aria-hidden="true">
      <div className="border-b border-[#e5ebf3] bg-[#f7f9fd] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#8b9ab3]">{title}</div>
      <div className="space-y-3 p-4">
        <p className="text-[13px] font-extrabold text-[#0b255f]">No hot water in hostel block C</p>
        <div className="flex items-center gap-3 rounded-xl bg-[#f3f7fd] p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbe6ff] text-[11px] font-extrabold text-[#174cb8]">{student === "Anonymous student" ? <EyeOff className="h-4 w-4" /> : "ID"}</span>
          <div className="min-w-0"><p className="truncate text-[13px] font-extrabold text-[#102c6b]">{student}</p><p className="text-[11px] text-[#8b9ab3]">{note}</p></div>
        </div>
        <div className="space-y-1.5"><div className="h-2 w-full rounded-full bg-[#e5ebf3]" /><div className="h-2 w-5/6 rounded-full bg-[#e5ebf3]" /></div>
      </div>
    </div>
  );
}

const STORED = [
  { icon: UserRound, title: "Your account", text: "Name, email, Student ID and Admission number. Your password is stored only as a salted hash, so nobody, including staff and administrators, can read it." },
  { icon: FileLock2, title: "Your complaints", text: "The text, category, location, priority, attached files, and the full status history with staff remarks." },
  { icon: KeyRound, title: "Your messages", text: "Chat messages between you and staff, and whether they were read. They belong to that one complaint." },
  { icon: History, title: "Notifications and sign-in", text: "Alerts about your complaints, and a secure cookie that keeps you signed in for 30 days on this device." },
];

const PROTECTIONS = [
  "Passwords are hashed with bcrypt. Entering a wrong password or a wrong staff access code is rate limited, so guessing does not work.",
  "Staff accounts need an access code held by the administrators. Students cannot make themselves staff.",
  "Attached files can only be opened by the student who filed the complaint and by staff. A link alone is not enough.",
  "Abusive language is blocked in complaints, feedback and chat, in English, Malayalam and Manglish, before it is saved.",
  "Every status change and remark is recorded with who made it and when, so staff actions can be reviewed.",
  "The session cookie is HttpOnly (scripts cannot read it) and expires after 30 days.",
];

const CHOICES: [string, string][] = [
  ["File anonymously", "Tick “Submit anonymously” and staff will not see even your Student ID."],
  ["Withdraw a complaint", "While it is still Pending you can withdraw it from the complaint page."],
  ["Correct your details", "Change your name, email or password any time in Settings."],
  ["Control pop-ups", "Switch the in-app pop-up alerts on or off in Settings."],
  ["Ask for removal", "There is no self-service delete yet. To have your account or a complaint removed, contact your college administrator."],
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="blueprint-grid bg-[#061b56] text-white">
        <div className="mx-auto max-w-[1180px] px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9fc4ff]">Privacy</p>
          <h1 className="mt-3 max-w-[760px] text-[32px] font-extrabold leading-[1.06] tracking-[-.05em] sm:text-[52px]">Your privacy, in plain words.</h1>
          <p className="mt-4 max-w-[620px] text-[14px] leading-7 text-[#b9ccef]">What CCMS keeps, who can see it, and what is never shown. Complaints can be sensitive, so the rules are simple and built into the system, not just promised.</p>
          <div className="mt-7 grid max-w-[640px] gap-3 sm:grid-cols-3">
            {[[UserRound, "Staff never see your name"], [EyeOff, "Anonymous means anonymous"], [ShieldCheck, "Nothing is shown to the public"]].map(([Icon, text]) => {
              const I = Icon as typeof UserRound;
              return <div key={text as string} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[.06] px-4 py-3 sm:block"><I className="h-5 w-5 shrink-0 text-[#9fc4ff]" /><p className="text-[12px] font-bold sm:mt-2">{text as string}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section id="who-sees-what" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-20">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">Who can see what</p>
        <h2 className="mt-3 max-w-[680px] text-[26px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">Staff see a Student ID. Never your name.</h2>
        <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#5d729a]">This is exactly what each person sees. Choose who is looking{" "}<span className="md:hidden">below</span><span className="hidden md:inline">or compare the columns</span>.</p>
        <div className="mt-8"><Matrix /></div>
        <p className="mt-4 max-w-[720px] rounded-xl bg-[#fff5e8] p-4 text-[12px] leading-5 text-[#8a5a1c]"><strong>Good to know:</strong> staff can open the files you attach. If a photo shows your face, your name or a name tag, staff will see that. Attach only what the complaint needs.</p>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-4 py-12 sm:px-6 sm:py-20 md:grid-cols-2 md:gap-14">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">Anonymous complaints</p>
            <h2 className="mt-3 text-[26px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">The choice is yours, per complaint.</h2>
            <p className="mt-3 text-[14px] leading-6 text-[#5d729a]">Tick “Submit anonymously” and staff see “Anonymous student” instead of a Student ID. This also holds in the inbox, the chat, the activity feed and exports. You can still follow the complaint and chat with staff, because the chat belongs to the complaint, not to your name.</p>
            <Link href="/how-it-works" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#174cb8] px-5 text-[12px] font-bold text-white hover:bg-[#123d9a]">See how it works <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StaffView title="Staff view · normal" student="Student ID CS/2021/045" note="Only the ID, no name or email" />
            <StaffView title="Staff view · anonymous" student="Anonymous student" note="Nothing that identifies you" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-20">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">What we keep</p>
        <h2 className="mt-3 text-[26px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">Only what the system needs.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {STORED.map(item => (
            <div key={item.title} className="flex gap-4 rounded-2xl border border-[#dbe4f1] bg-white p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#2458c4]"><item.icon className="h-5 w-5" /></span>
              <div><p className="text-[14px] font-extrabold text-[#18366f]">{item.title}</p><p className="mt-1 text-[12px] leading-5 text-[#5d729a]">{item.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#071e5c] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.1fr] md:gap-14">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9fc4ff]">How it is protected</p>
            <h2 className="mt-3 text-[26px] font-extrabold tracking-[-.05em] sm:text-[34px]">Safeguards that are actually switched on.</h2>
            <div className="mt-5 flex items-center gap-2 text-[12px] text-[#b8c9ec]"><Lock className="h-4 w-4" />Built into the application itself</div>
          </div>
          <ul className="space-y-3">
            {PROTECTIONS.map(text => <li key={text} className="flex gap-3 rounded-xl border border-white/15 bg-white/[.06] p-4 text-[13px] leading-5 text-[#d6e2fa]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9fc4ff]" /><span>{text}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[860px] px-4 py-12 sm:px-6 sm:py-20">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#4771c1]">Your choices</p>
        <h2 className="mt-3 text-[26px] font-extrabold tracking-[-.05em] text-[#0e2b68] sm:text-[34px]">You stay in control.</h2>
        <dl className="mt-8 divide-y divide-[#e5ebf3] overflow-hidden rounded-2xl border border-[#dbe4f1] bg-white">
          {CHOICES.map(([title, text]) => (
            <div key={title} className="px-5 py-4"><dt className="text-[14px] font-extrabold text-[#18366f]">{title}</dt><dd className="mt-1 text-[13px] leading-5 text-[#5d729a]">{text}</dd></div>
          ))}
        </dl>
      </section>

      <section className="bg-[#061b56] text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <div><h2 className="text-[24px] font-extrabold tracking-[-.045em] sm:text-[30px]">Questions about your data?</h2><p className="mt-2 text-[13px] text-[#b9ccef]">Ask your college administrator. They manage accounts and staff access.</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-[12px] font-extrabold text-[#174cb8] hover:bg-[#eef4ff]">Create account <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <Link href="/how-it-works" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/[.06] px-6 text-[12px] font-bold hover:bg-white/10">How it works</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
