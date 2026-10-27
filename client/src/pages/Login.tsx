import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Shield, Eye, EyeOff, FileText, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { startLogin } from "@/const";

type LoginMode = "student" | "staff";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<LoginMode>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();
  // Manus OAuth only works when its portal is configured; email/password is the default.
  const oauthEnabled = Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);

  const handleOAuthLogin = () => {
    startLogin();
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      toast.success("Login successful!", {
        description: `Welcome back, ${data.user?.name || "User"}!`
      });
      // Load the new session into the cache before navigating so /workspace doesn't see a stale "logged out" user.
      await utils.auth.me.fetch();
      navigate("/workspace");
    },
    onError: (err) => {
      const errorData = err.data as { field?: string; message?: string } | undefined;
      if (errorData?.field) {
        setErrors({ [errorData.field]: errorData.message || "Invalid input" });
      }
      toast.error("Login failed", { description: err.message });
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Invalid email format" });
      return;
    }
    if (!password) {
      setErrors({ password: "Password is required" });
      return;
    }
    
    setIsLoading(true);
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#f7f9fd] px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#87adfa]/70 bg-[#174cb8] text-white shadow-[0_8px_24px_rgba(20,76,184,.3)]">
              <div className="absolute inset-[8px] border border-white/60" />
              <div className="absolute h-[2px] w-7 bg-white/80" />
              <div className="absolute h-7 w-[2px] bg-white/80" />
              <span className="relative text-[12px] font-black tracking-tight">CC</span>
            </div>
            <div>
              <p className="text-[18px] font-extrabold tracking-[-.03em] text-[#0b255f]">CCMS</p>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#7788a5]">Campus Complaint Management</p>
            </div>
          </Link>
        </div>

        {/* Mode Selector */}
        <div className="mb-6 rounded-[14px] border border-[#dbe4f1] bg-white p-1 shadow-sm">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("student")}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-bold transition ${mode === "student" ? "bg-[#174cb8] text-white shadow-sm" : "text-[#5d729a] hover:text-[#174cb8] hover:bg-[#f0f4fa]"}`}
            >
              <User className="mr-2 h-4 w-4 inline" />
              Student
            </button>
            <button
              onClick={() => setMode("staff")}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-bold transition ${mode === "staff" ? "bg-[#174cb8] text-white shadow-sm" : "text-[#5d729a] hover:text-[#174cb8] hover:bg-[#f0f4fa]"}`}
            >
              <Shield className="mr-2 h-4 w-4 inline" />
              Staff
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[.16em] text-[#8ba9e9]">
            {mode === "student" ? "Student portal access" : "Staff console access"}
          </p>
        </div>

        {/* Login Form */}
        <Card className="bg-white shadow-[0_12px_32px_rgba(16,41,102,.08)] border-[#dbe4f1]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-[22px] font-extrabold text-[#0b255f]">
              {mode === "student" ? "Student Sign In" : "Staff Sign In"}
            </CardTitle>
            <CardDescription className="text-[#7788a5]">
              {mode === "student"
                ? "Access your complaint dashboard"
                : "Access the triage inbox and reports"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {oauthEnabled && (
              <>
            {/* OAuth Login Button - Primary */}
              <Button
                onClick={handleOAuthLogin}
                className="w-full h-11 rounded-xl bg-[#174cb8] text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Continue with Campus Account
                  </>
                )}
              </Button>
  
              <Separator className="my-4" />
              </>
            )}

            {/* Credential Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-bold text-[#5d729a]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9aabc4]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={mode === "student" ? "student@campus.edu" : "staff@campus.edu"}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: "" })); }}
                    className={`pl-9 ${errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-bold text-[#5d729a]">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9aabc4]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: "" })); }}
                    className={`h-11 pl-9 pr-11 ${errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#9aabc4] hover:text-[#5d729a]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl bg-[#174cb8] text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4 border-t border-[#f0f4fa]">
            <p className="text-center text-[12px] text-[#5d729a]">
              {mode === "student" ? "New student?" : "New staff member?"}{" "}
              <Link href={mode === "student" ? "/register" : "/register?role=staff"} className="tap-area font-bold text-[#174cb8] hover:underline">{mode === "student" ? "Create an account" : "Create a staff account"}</Link>
            </p>
            <Link
              href="/"
              className="tap-area text-center text-[12px] font-bold text-[#5d729a] hover:text-[#174cb8]"
            >
              ← Back to home
            </Link>
            {import.meta.env.DEV && (
              <Link
                href="/dev-login"
                className="tap-area text-center text-[12px] font-bold text-[#b46317] hover:text-[#b46317] underline"
              >
                Use Development Login (no OAuth required)
              </Link>
            )}
          </CardFooter>
        </Card>

        {/* Features */}
        <div className="mt-8 grid gap-4 text-center sm:grid-cols-3">
          <div className="rounded-[14px] border border-[#dbe4f1] bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ff] text-[#2458c4] mx-auto">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-[12px] font-bold text-[#18366f]">Submit</p>
            <p className="text-[10px] text-[#8b9ab3]">File complaints easily</p>
          </div>
          <div className="rounded-[14px] border border-[#dbe4f1] bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f7ff] text-[#1684b5] mx-auto">
              <Shield className="h-5 w-5" />
            </div>
            <p className="text-[12px] font-bold text-[#18366f]">Track</p>
            <p className="text-[10px] text-[#8b9ab3]">Monitor progress in real-time</p>
          </div>
          <div className="rounded-[14px] border border-[#dbe4f1] bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eafaf1] text-[#168052] mx-auto">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-[12px] font-bold text-[#18366f]">Resolve</p>
            <p className="text-[10px] text-[#8b9ab3]">Get timely resolutions</p>
          </div>
        </div>
      </div>
    </div>
  );
}