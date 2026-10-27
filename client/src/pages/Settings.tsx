import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Bell, Check, Eye, EyeOff, GraduationCap, Hash, Loader2, Lock, Mail, Moon, Palette, Save, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type Tab = "profile" | "notifications" | "security" | "appearance";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "appearance", label: "Appearance", icon: Palette },
];

const POPUP_KEY = "ccms-popups";
const readPopupPreference = () => {
  try { return localStorage.getItem(POPUP_KEY) !== "off"; } catch { return true; }
};

const CARD = "border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]";
const CARD_HEADER = "border-b border-[#e5ebf3] px-5 py-4";
const CARD_TITLE = "text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]";
const LABEL = "text-[11px] font-bold text-[#5d729a]";

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="text-[11px] text-red-500">{message}</p> : null;
}

export default function Settings() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();

  const initialTab = new URLSearchParams(search).get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some(t => t.id === initialTab) ? (initialTab as Tab) : "profile");

  // Signed-out visitors have nothing to manage here.
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  // Back goes to wherever the user came from; if the page was opened directly, to the workspace.
  const goBack = () => (window.history.length > 1 ? window.history.back() : navigate("/workspace"));

  // ---- profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileError, setProfileError] = useState<{ name?: string; email?: string }>({});
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Profile updated");
    },
    onError: err => {
      if (/email/i.test(err.message)) setProfileError({ email: err.message });
      toast.error("Could not update profile", { description: err.message });
    },
  });
  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof profileError = {};
    if (name.trim().length < 2) errors.name = "Name must be at least 2 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address";
    setProfileError(errors);
    if (Object.keys(errors).length === 0) updateProfile.mutate({ name: name.trim(), email: email.trim() });
  };
  const profileDirty = !!user && (name.trim() !== (user.name ?? "") || email.trim().toLowerCase() !== (user.email ?? ""));

  // ---- notifications (in-app pop-ups; saved on this device)
  const [popups, setPopups] = useState(readPopupPreference);
  const setPopupPreference = (on: boolean) => {
    setPopups(on);
    try { localStorage.setItem(POPUP_KEY, on ? "on" : "off"); } catch { /* storage blocked: applies until reload */ }
    toast.success(on ? "Pop-up alerts on" : "Pop-up alerts off");
  };

  // ---- password
  const [show, setShow] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordError({});
      toast.success("Password changed", { description: "Use your new password next time you sign in." });
    },
    onError: err => {
      if (err.data?.code === "UNAUTHORIZED") setPasswordError({ current: err.message });
      toast.error("Could not change password", { description: err.message });
    },
  });
  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof passwordError = {};
    if (!passwords.current) errors.current = "Enter your current password";
    if (passwords.next.length < 8) errors.next = "At least 8 characters";
    else if (!/[a-z]/.test(passwords.next) || !/[A-Z]/.test(passwords.next) || !/\d/.test(passwords.next)) errors.next = "Use an uppercase letter, a lowercase letter and a number";
    if (passwords.next !== passwords.confirm) errors.confirm = "Passwords do not match";
    setPasswordError(errors);
    if (Object.keys(errors).length === 0) changePassword.mutate({ currentPassword: passwords.current, newPassword: passwords.next });
  };

  if (loading || !user) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#061b56] text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const isStudent = user.role !== "admin";

  return (
    <div className="blueprint-app min-h-dvh bg-[#061b56]">
      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-9">
        <Button type="button" variant="ghost" onClick={goBack} className="-ml-3 mb-4 h-9 gap-2 rounded-xl px-3 text-[12px] font-bold text-[#c1d2f9] hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="mb-7">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9dbdff]">{isStudent ? "Student account" : "Staff account"}</p>
          <h1 className="mt-2 text-[27px] font-extrabold tracking-[-.055em] text-white sm:text-[31px]">Settings &amp; profile</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map(item => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}
                className={cn("flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-[12px] font-semibold transition lg:w-full",
                  tab === item.id ? "bg-white text-[#174cb8] shadow-[0_8px_20px_rgba(0,0,0,.16)]" : "text-[#c1d2f9] hover:bg-white/[.09] hover:text-white")}>
                <item.icon className={cn("h-5 w-5", tab === item.id ? "text-[#174cb8]" : "text-[#90b2f6]")} />
                {item.label}
              </button>
            ))}
            <div className="hidden border-t border-white/10 pt-6 lg:mt-4 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7192d8]">Signed in as</p>
              <p className="mt-2 truncate text-[12px] font-bold text-white">{user.name || "User"}</p>
              <p className="truncate text-[11px] text-[#90a9dc]">{user.email || "No email"}</p>
            </div>
          </nav>

          <div className="min-w-0 max-w-[760px]">
            {tab === "profile" && (
              <Card className={CARD}>
                <CardHeader className={CARD_HEADER}><CardTitle className={CARD_TITLE}>Profile</CardTitle><CardDescription>How you appear in CCMS.</CardDescription></CardHeader>
                <CardContent className="p-5">
                  <form onSubmit={saveProfile} className="space-y-5" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-name" className={LABEL}>Full name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aabc4]" />
                        <Input id="profile-name" value={name} onChange={e => { setName(e.target.value); setProfileError(p => ({ ...p, name: undefined })); }} className="h-10 pl-9 text-[13px]" autoComplete="name" aria-invalid={!!profileError.name} />
                      </div>
                      <FieldError message={profileError.name} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email" className={LABEL}>Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aabc4]" />
                        <Input id="profile-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setProfileError(p => ({ ...p, email: undefined })); }} className="h-10 pl-9 text-[13px]" autoComplete="email" aria-invalid={!!profileError.email} />
                      </div>
                      <FieldError message={profileError.email} />
                    </div>

                    {isStudent && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className={LABEL}>Student ID</Label>
                          <div className="flex h-10 items-center gap-2 rounded-lg border border-[#dce5f1] bg-[#f3f7fd] px-3 text-[13px] font-semibold text-[#18366f]"><Hash className="h-4 w-4 text-[#9aabc4]" />{user.studentId || "Not on record"}</div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className={LABEL}>Admission number</Label>
                          <div className="flex h-10 items-center gap-2 rounded-lg border border-[#dce5f1] bg-[#f3f7fd] px-3 text-[13px] font-semibold text-[#18366f]"><GraduationCap className="h-4 w-4 text-[#9aabc4]" />{user.admissionNumber || "Not on record"}</div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className={LABEL}>Role</Label>
                      <div className="flex items-center gap-2 rounded-lg border border-[#dce5f1] bg-white px-3 py-2">
                        <Badge variant={isStudent ? "secondary" : "default"} className="text-[11px]">{isStudent ? "Student" : "Staff / Administrator"}</Badge>
                        <span className="text-[11px] text-[#8b9ab3]">{isStudent ? "Student ID and admission number are fixed after registration." : "Assigned by a system administrator."}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-[#e5ebf3] pt-4">
                      <Button type="submit" disabled={!profileDirty || updateProfile.isPending} className="h-11 rounded-xl bg-[#174cb8] px-6 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]">
                        {updateProfile.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-2 h-4 w-4" />Save changes</>}
                      </Button>
                      <Button type="button" variant="ghost" onClick={goBack} className="h-11 rounded-xl px-4 text-[12px] font-bold text-[#5d729a]">Back</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {tab === "notifications" && (
              <Card className={CARD}>
                <CardHeader className={CARD_HEADER}><CardTitle className={CARD_TITLE}>Notifications</CardTitle><CardDescription>How CCMS tells you something new has happened.</CardDescription></CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-[#dce5f1] p-4">
                    <div>
                      <p className="text-[13px] font-bold text-[#18366f]">Pop-up alerts</p>
                      <p className="mt-0.5 text-[11px] text-[#8b9ab3]">{isStudent ? "Show a pop-up when staff reply or your complaint changes." : "Show a pop-up when a new complaint or a student message arrives."}</p>
                    </div>
                    <Switch checked={popups} onCheckedChange={setPopupPreference} aria-label="Pop-up alerts" />
                  </div>
                  <p className="rounded-xl bg-[#f3f7fd] p-4 text-[12px] leading-5 text-[#5d729a]">
                    The red numbers on the bell and the sidebar are always on. Email and SMS alerts are not set up for this system yet, so there is nothing to switch on for them.
                  </p>
                </CardContent>
              </Card>
            )}

            {tab === "security" && (
              <Card className={CARD}>
                <CardHeader className={CARD_HEADER}><CardTitle className={CARD_TITLE}>Change password</CardTitle><CardDescription>You will stay signed in on this device.</CardDescription></CardHeader>
                <CardContent className="p-5">
                  <form onSubmit={submitPassword} className="space-y-5" noValidate>
                    {([
                      ["current", "Current password", "current-password"],
                      ["next", "New password", "new-password"],
                      ["confirm", "Confirm new password", "new-password"],
                    ] as const).map(([key, label, autoComplete]) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`pw-${key}`} className={LABEL}>{label}</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aabc4]" />
                          <Input id={`pw-${key}`} type={show ? "text" : "password"} value={passwords[key]} autoComplete={autoComplete} maxLength={72}
                            onChange={e => { setPasswords(p => ({ ...p, [key]: e.target.value })); setPasswordError(p => ({ ...p, [key]: undefined })); }}
                            className="h-10 pl-9 pr-10 text-[13px]" aria-invalid={!!passwordError[key]} />
                          {key === "current" && (
                            <button type="button" onClick={() => setShow(s => !s)} className="tap-area absolute right-3 top-1/2 -translate-y-1/2 text-[#9aabc4] hover:text-[#174cb8]" aria-label={show ? "Hide passwords" : "Show passwords"}>
                              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        <FieldError message={passwordError[key]} />
                      </div>
                    ))}
                    <p className="text-[11px] text-[#8b9ab3]">At least 8 characters, with an uppercase letter, a lowercase letter and a number.</p>
                    <div className="flex items-center gap-3 border-t border-[#e5ebf3] pt-4">
                      <Button type="submit" disabled={changePassword.isPending} className="h-11 rounded-xl bg-[#174cb8] px-6 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]">
                        {changePassword.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</> : "Update password"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={goBack} className="h-11 rounded-xl px-4 text-[12px] font-bold text-[#5d729a]">Back</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {tab === "appearance" && (
              <Card className={CARD}>
                <CardHeader className={CARD_HEADER}><CardTitle className={CARD_TITLE}>Appearance</CardTitle><CardDescription>Choose how CCMS looks. It is remembered on this device.</CardDescription></CardHeader>
                <CardContent className="p-5">
                  <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
                    {([["light", "Light", "Bright cards on a light background", Sun], ["dark", "Dark", "Easier on the eyes at night", Moon]] as const).map(([value, label, description, Icon]) => (
                      <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => toggleTheme?.(value)}
                        className={cn("relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition", theme === value ? "border-[#174cb8] bg-[#eaf1ff]" : "border-[#dce5f1] bg-white hover:border-[#9cb7e9]")}>
                        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", value === "light" ? "bg-[#fff4e6] text-[#ba6915]" : "bg-[#1b2a5c] text-[#9fc4ff]")}><Icon className="h-5 w-5" /></span>
                        <span><span className="block text-[13px] font-bold text-[#18366f]">{label}</span><span className="block text-[11px] text-[#8b9ab3]">{description}</span></span>
                        {theme === value && <Check className="absolute right-3 top-3 h-5 w-5 text-[#174cb8]" />}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
