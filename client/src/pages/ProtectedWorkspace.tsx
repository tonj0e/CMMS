import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import Workspace from "./Workspace";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ProtectedWorkspace() {
  const [, navigate] = useLocation();
  const { user, loading, refresh } = useAuth({ redirectOnUnauthenticated: false });

  // Coming back to a tab re-checks who is signed in.
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // The browser keeps one login for every tab. If another tab signs in as someone else, say so instead of switching silently.
  const shownAs = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    if (shownAs.current !== null && shownAs.current !== user.id) {
      toast.warning(`Now signed in as ${user.name ?? "another account"} (${user.role === "admin" ? "Staff" : "Student"})`, {
        description: "Another tab signed in to a different account. All tabs in this browser share one login. Use a private window to be signed in as two people at once.",
        duration: 12000,
      });
    }
    shownAs.current = user.id;
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#071e5c] text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return <Workspace />;
}
