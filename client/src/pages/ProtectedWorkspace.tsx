import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import Workspace from "./Workspace";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ProtectedWorkspace() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#071e5c] text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return <Workspace />;
}
