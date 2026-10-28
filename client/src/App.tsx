import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Everything except the landing page is loaded on demand, so a first visit downloads far less JavaScript.
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ProtectedWorkspace = lazy(() => import("./pages/ProtectedWorkspace"));
const ComplaintDetail = lazy(() => import("./pages/ComplaintDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#061b56] text-white" role="status" aria-label="Loading">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/track" component={Home} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/workspace" component={ProtectedWorkspace} />
        <Route path="/workspace/settings" component={Settings} />
        <Route path="/workspace/complaints/:id" component={ComplaintDetail} />
        <Route path="/staff/complaints/:id" component={ComplaintDetail} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
