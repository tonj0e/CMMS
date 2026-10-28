import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Eye, EyeOff, FileText, GraduationCap, Hash, Loader2, Lock, Mail, Shield, User, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Mode = "student" | "staff";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_-]{2,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordProblem(password: string) {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return "";
}

function strengthOf(password: string) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Very weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 4) return { score, label: "Good", color: "bg-lime-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

/**
 * One labelled field. The icon and the optional trailing button are positioned against a wrapper that holds only the input,
 * so they stay vertically centred whatever sits below it (error text, strength meter).
 */
function Field({ id, label, icon: Icon, error, trailing, children }: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; error?: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-bold text-[#5d729a]">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aabc4]" />
        {children}
        {trailing}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3 shrink-0" />{error}</p>
      )}
    </div>
  );
}

function ShowPasswordButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#9aabc4] hover:text-[#5d729a]">
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

export default function Register() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [mode, setMode] = useState<Mode>(new URLSearchParams(search).get("role") === "staff" ? "staff" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();
  const onSuccess = async (data: { user: { name: string | null }; pending?: boolean }) => {
    if (data.pending) toast.success("Request sent", { description: "A staff member needs to approve your staff account before you can use it." });
    else toast.success("Registration successful!", { description: `Welcome ${data.user.name}! Redirecting to your workspace...` });
    await utils.auth.me.fetch();
    navigate("/workspace");
  };
  const onError = (err: { message: string }) => {
    // Server messages name the field that clashed or failed ("Student ID already registered", "...access code is not correct").
    const field = /^Student ID/.test(err.message) ? "studentId" : /^Admission/.test(err.message) ? "admissionNumber" : /^Email/.test(err.message) ? "email" : null;
    if (field) setErrors({ [field]: err.message });
    toast.error("Registration failed", { description: err.message });
  };
  const studentRegister = trpc.auth.register.useMutation({ onSuccess, onError });
  const staffRegister = trpc.auth.registerStaff.useMutation({ onSuccess, onError });
  const isLoading = studentRegister.isPending || staffRegister.isPending;

  const clear = (field: string) => setErrors(prev => ({ ...prev, [field]: "" }));
  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  const validate = () => {
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = name.trim() ? "Name must be at least 2 characters" : "Name is required";
    if (!EMAIL_PATTERN.test(email.trim())) found.email = email.trim() ? "Invalid email format" : "Email is required";
    if (mode === "student") {
      if (!studentId.trim()) found.studentId = "Student ID is required";
      else if (!ID_PATTERN.test(studentId.trim())) found.studentId = "3-32 characters: letters, numbers, - _ /";
      if (!admissionNumber.trim()) found.admissionNumber = "Admission number is required";
      else if (!ID_PATTERN.test(admissionNumber.trim())) found.admissionNumber = "3-32 characters: letters, numbers, - _ /";
    }
    const problem = passwordProblem(password);
    if (problem) found.password = problem;
    if (password !== confirmPassword) found.confirmPassword = "Passwords do not match";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const common = { name: name.trim(), email: email.trim().toLowerCase(), password };
    if (mode === "student") studentRegister.mutate({ ...common, studentId: studentId.trim(), admissionNumber: admissionNumber.trim() });
    else staffRegister.mutate(common);
  };

  const strength = strengthOf(password);
  const inputClass = (field: string, extra = "") => cn("h-11 pl-9", extra, errors[field] && "border-red-500 focus:border-red-500 focus:ring-red-500/20");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f9fd] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#87adfa]/70 bg-[#174cb8] text-white shadow-[0_8px_24px_rgba(20,76,184,.3)]">
              <div className="absolute inset-[8px] border border-white/60" />
              <div className="absolute h-[2px] w-7 bg-white/80" />
              <div className="absolute h-7 w-[2px] bg-white/80" />
              <span className="relative text-[12px] font-black tracking-tight">CC</span>
            </div>
            <div className="text-left">
              <p className="text-[18px] font-extrabold tracking-[-.03em] text-[#0b255f]">CCMS</p>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#7788a5]">Campus Complaint Management</p>
            </div>
          </Link>
        </div>

        <div className="mb-5 rounded-[14px] border border-[#dbe4f1] bg-white p-1 shadow-sm" role="tablist" aria-label="Account type">
          <div className="flex items-center gap-1">
            {([["student", "Student", User], ["staff", "Staff", Shield]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => switchMode(id)}
                className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-bold transition",
                  mode === id ? "bg-[#174cb8] text-white shadow-sm" : "text-[#5d729a] hover:bg-[#f0f4fa] hover:text-[#174cb8]")}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </div>

        <Card className="border-[#dbe4f1] bg-white shadow-[0_12px_32px_rgba(16,41,102,.08)]">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-[22px] font-extrabold text-[#0b255f]">Create {mode === "student" ? "Student" : "Staff"} Account</CardTitle>
            <CardDescription className="text-[#7788a5]">
              {mode === "student" ? "Register to submit and track campus complaints" : "Register to review, assign and resolve campus complaints"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field id="name" label="Full Name" icon={User} error={errors.name}>
                <Input id="name" value={name} onChange={e => { setName(e.target.value); clear("name"); }} placeholder="Enter your full name" className={inputClass("name")} disabled={isLoading} autoComplete="name" />
              </Field>

              {mode === "student" && (
                <>
                  <Field id="studentId" label="Student ID" icon={Hash} error={errors.studentId}>
                    <Input id="studentId" value={studentId} onChange={e => { setStudentId(e.target.value); clear("studentId"); }} placeholder="e.g. CS/2021/045" className={inputClass("studentId", "uppercase placeholder:normal-case")} disabled={isLoading} autoComplete="off" />
                  </Field>
                  <Field id="admissionNumber" label="Admission Number" icon={GraduationCap} error={errors.admissionNumber}>
                    <Input id="admissionNumber" value={admissionNumber} onChange={e => { setAdmissionNumber(e.target.value); clear("admissionNumber"); }} placeholder="e.g. ADM-20210045" className={inputClass("admissionNumber", "uppercase placeholder:normal-case")} disabled={isLoading} autoComplete="off" />
                  </Field>
                </>
              )}

              <Field id="email" label="Email Address" icon={Mail} error={errors.email}>
                <Input id="email" type="email" value={email} onChange={e => { setEmail(e.target.value); clear("email"); }} placeholder={mode === "student" ? "student@campus.edu" : "staff@campus.edu"} className={inputClass("email")} disabled={isLoading} autoComplete="email" />
              </Field>

              {mode === "staff" && (
                <p className="flex items-start gap-2 rounded-xl bg-[#f3f7fd] p-3 text-[11px] leading-4 text-[#5d729a]"><UserCog className="mt-0.5 h-4 w-4 shrink-0 text-[#2458c4]" />Staff do not need a Student ID. A staff member approves new staff accounts before they can use them.</p>
              )}

              <div className="space-y-1.5">
                <Field id="password" label="Password" icon={Lock} error={errors.password} trailing={<ShowPasswordButton shown={showPassword} onToggle={() => setShowPassword(v => !v)} />}>
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); clear("password"); }} placeholder="Create a strong password" className={inputClass("password", "pr-11")} disabled={isLoading} autoComplete="new-password" maxLength={72} />
                </Field>
                {password && (
                  <div>
                    <div className="flex gap-1">{[1, 2, 3, 4, 5].map(i => <div key={i} className={cn("h-1 flex-1 rounded-full", i <= strength.score ? strength.color : "bg-[#e5ebf3]")} />)}</div>
                    <p className="mt-1 text-[11px] text-[#7788a5]">Password strength: {strength.label}</p>
                  </div>
                )}
              </div>

              <Field id="confirmPassword" label="Confirm Password" icon={Lock} error={errors.confirmPassword} trailing={<ShowPasswordButton shown={showPassword} onToggle={() => setShowPassword(v => !v)} />}>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clear("confirmPassword"); }} placeholder="Confirm your password" className={inputClass("confirmPassword", "pr-11")} disabled={isLoading} autoComplete="new-password" maxLength={72} />
              </Field>

              <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-[#174cb8] text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : `Create ${mode === "student" ? "Student" : "Staff"} Account`}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-[#f0f4fa] pt-4">
            <p className="text-center text-[11px] text-[#8ba9e9]">By creating an account, you agree to use CCMS for genuine campus complaints only. <Link href="/privacy" className="font-bold underline">How we protect your privacy</Link></p>
            <Link href="/login" className="tap-area text-center text-[12px] font-bold text-[#5d729a] hover:text-[#174cb8]">Already have an account? Sign in</Link>
          </CardFooter>
        </Card>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center sm:gap-4">
          {([[FileText, "Submit", "File complaints easily", "bg-[#edf3ff] text-[#2458c4]"], [Shield, "Track", "See progress live", "bg-[#e9f7ff] text-[#1684b5]"], [CheckCircle, "Resolve", "Get timely answers", "bg-[#eafaf1] text-[#168052]"]] as const).map(([Icon, title, note, tone]) => (
            <div key={title} className="rounded-[14px] border border-[#dbe4f1] bg-white p-3 shadow-sm sm:p-4">
              <div className={cn("mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl", tone)}><Icon className="h-4 w-4" /></div>
              <p className="text-[12px] font-bold text-[#18366f]">{title}</p>
              <p className="text-[10px] leading-tight text-[#8b9ab3]">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
