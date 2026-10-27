import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, User, Shield, Check, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

type DevRole = "student" | "staff";

interface DevUser {
  id: number;
  openId: string;
  name: string;
  email: string | null;
  role: "user" | "admin";
}

export default function DevLogin() {
  const [, navigate] = useLocation();
  const [selectedRole, setSelectedRole] = useState<DevRole>("student");
  const [isLoading, setIsLoading] = useState(false);

  const utils = trpc.useUtils();
  // devLogin is only available in development mode
  const devLoginMutation = trpc.auth.devLogin?.useMutation({
    onSuccess: async (data: { success: boolean; user?: { name?: string | null; role?: string | null } | null }) => {
      toast.success("Development login successful", {
        description: `Logged in as ${data.user?.name ?? "User"} (${data.user?.role ?? "user"})`
      });
      await utils.auth.me.fetch();
      navigate("/workspace");
    },
    onError: (err) => {
      toast.error("Development login failed", { description: err.message });
      setIsLoading(false);
    },
  });

  const handleLogin = (role: DevRole) => {
    setSelectedRole(role);
    setIsLoading(true);
    devLoginMutation?.mutate({ role });
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

        {/* Dev Mode Banner */}
        <div className="mb-6 rounded-[14px] border border-[#f5d2a4] bg-[#fff5e8] p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#b46317]">
            <Shield className="h-4 w-4" />
            <span>Development Authentication Mode</span>
          </div>
          <p className="mt-1 text-[10px] text-[#b46317]">
            This mode is enabled for local development. No OAuth credentials required.
          </p>
        </div>

        {/* Login Options */}
        <Card className="bg-white shadow-[0_12px_32px_rgba(16,41,102,.08)] border-[#dbe4f1]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-[22px] font-extrabold text-[#0b255f]">Choose your role</CardTitle>
            <CardDescription className="text-[#7788a5]">
              Select a development account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => handleLogin("student")}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-[#174cb8] text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a] flex items-center justify-center gap-3"
            >
              {isLoading && selectedRole === "student" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <User className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-bold">Continue as Student</div>
                    <div className="text-[10px] opacity-80">student@ccms.local • Role: user</div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <Separator />

            <Button
              onClick={() => handleLogin("staff")}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-[#174cb8] text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a] flex items-center justify-center gap-3"
            >
              {isLoading && selectedRole === "staff" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-bold">Continue as Staff</div>
                    <div className="text-[10px] opacity-80">staff@ccms.local • Role: admin</div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4 border-t border-[#f0f4fa]">
            <div className="rounded-[10px] border border-[#dbe4f1] bg-white p-3 text-[10px] font-bold text-[#8ba9e9] text-center">
              <Check className="inline h-3.5 w-3.5 text-[#2aad75] mr-1" />
              Dev users are auto-created on first login
            </div>
            <Link
              href="/"
              className="text-center text-[12px] font-bold text-[#5d729a] hover:text-[#174cb8]"
            >
              ← Back to home
            </Link>
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