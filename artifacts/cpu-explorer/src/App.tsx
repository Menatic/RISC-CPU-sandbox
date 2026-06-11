import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import IDE from "@/pages/IDE";
import Pipeline from "@/pages/Pipeline";
import Evolution from "@/pages/Evolution";
import Hazards from "@/pages/Hazards";
import Forwarding from "@/pages/Forwarding";
import BranchPredictor from "@/pages/BranchPredictor";
import Cache from "@/pages/Cache";
import Superscalar from "@/pages/Superscalar";
import OutOfOrder from "@/pages/OutOfOrder";
import Sandbox from "@/pages/Sandbox";
import Blueprint from "@/pages/Blueprint";
import Timeline from "@/pages/Timeline";
import Analytics from "@/pages/Analytics";
import Compare from "@/pages/Compare";
import Interview from "@/pages/Interview";
import Showcase from "@/pages/Showcase";
import Speculative from "@/pages/Speculative";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <TopBar />
      <Sidebar />
      <main className="flex-1 ml-64 mt-16 overflow-y-auto">
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/ide" component={IDE} />
          <Route path="/pipeline" component={Pipeline} />
          <Route path="/evolution" component={Evolution} />
          <Route path="/hazards" component={Hazards} />
          <Route path="/forwarding" component={Forwarding} />
          <Route path="/branch" component={BranchPredictor} />
          <Route path="/cache" component={Cache} />
          <Route path="/superscalar" component={Superscalar} />
          <Route path="/ooo" component={OutOfOrder} />
          <Route path="/speculative" component={Speculative} />
          <Route path="/blueprint" component={Blueprint} />
          <Route path="/timeline" component={Timeline} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/compare" component={Compare} />
          <Route path="/sandbox" component={Sandbox} />
          <Route path="/interview" component={Interview} />
          <Route path="/showcase" component={Showcase} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
