import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

/** Header, page area and footer shared by the public information pages (guide, privacy). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const goBack = () => (window.history.length > 1 ? window.history.back() : navigate("/"));
  return (
    <div className="min-h-dvh bg-[#f7f9fd] text-[#102c6b]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#061b56]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
          <button type="button" onClick={goBack} className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-white/80 hover:bg-white/10 hover:text-white" aria-label="Go back">
            <ArrowLeft className="h-4 w-4" /><span className="hidden min-[380px]:inline">Back</span>
          </button>
          <Link href="/" className="min-w-0 truncate text-[13px] font-extrabold tracking-tight text-white">CCMS<span className="hidden font-semibold text-[#9fc4ff] md:inline"> · Campus Complaint Management</span></Link>
          <nav className="flex items-center gap-1" aria-label="Public pages">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} aria-current={location === item.href ? "page" : undefined}
                className={cn("hidden rounded-lg px-3 py-2 text-[11px] font-bold sm:block", location === item.href ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}>{item.label}</Link>
            ))}
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white md:block">Sign in</Link>
            <Link href="/register" className="ml-1 rounded-xl bg-white px-3.5 py-2.5 text-[11px] font-bold text-[#174cb8] hover:bg-[#eef4ff]">Create account</Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-[#dbe4f1] bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[13px] font-extrabold text-[#0e2b68]">CCMS</p><p className="text-[11px] text-[#8b9ab3]">Campus Complaint Management System</p></div>
          <nav className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] font-bold text-[#5d729a] sm:flex sm:flex-wrap" aria-label="Footer">
            {[["/", "Home"], ["/how-it-works", "How it works"], ["/privacy", "Privacy"], ["/login", "Sign in"], ["/register", "Create account"]].map(([href, label]) => (
              <Link key={href} href={href} className="flex min-h-10 items-center hover:text-[#174cb8] sm:min-h-0">{label}</Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
