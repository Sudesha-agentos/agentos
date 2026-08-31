import { Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { SidebarProvider, useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import { AppThemeProvider } from "../../shared/hooks/useAppTheme";
import { WorkspaceModeProvider, useWorkspaceMode } from "../../shared/hooks/useWorkspaceMode";
import { useOrgNavigation } from "../../shared/routing/useOrgNavigation";
import AppPageFallback from "../../shared/ui/AppPageFallback";
import AppPageTransition from "../../shared/ui/AppPageTransition";
import RouteErrorBoundary from "../../shared/ui/RouteErrorBoundary";
import { CodebaseCommandPaletteProvider } from "../../widgets/codebase-search/CodebaseCommandPalette";
import GithubOAuthRedirect from "./GithubOAuthRedirect";
import JiraOAuthRedirect from "./JiraOAuthRedirect";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import IntegrationRefreshBar from "./IntegrationRefreshBar";
import TopBar from "./TopBar";
import WebsitePreview from "./WebsitePreview";
import IntakeAssignmentListener from "../../shared/components/IntakeAssignmentListener";
import ProductTourController from "../../features/product-tour/ProductTourController";
import { useDocumentRobots } from "../../shared/seo/useDocumentRobots";

function AppOutlet() {
  return (
    <Suspense fallback={<AppPageFallback />}>
      <RouteErrorBoundary>
        <AppPageTransition />
      </RouteErrorBoundary>
    </Suspense>
  );
}

function AppShellContent() {
  const { collapsed } = useSidebarCollapsed();
  const { pathMatches, orgPath, location } = useOrgNavigation();
  const { isPreview, setWork } = useWorkspaceMode();
  const onSettings = pathMatches("settings");
  const onSimLab = pathMatches("sim-testing-for-testing");
  const onCreateNew = location.pathname === orgPath();
  const showPreview = isPreview && onCreateNew;

  useEffect(() => {
    if (!onCreateNew && isPreview) setWork();
  }, [onCreateNew, isPreview, setWork]);

  return (
    <div
      className={`flex flex-col bg-app-canvas ${
        showPreview ? "h-svh overflow-hidden" : "min-h-screen"
      }`}
    >
      {onSimLab ? null : (
        <>
          <TopBar />
          <IntegrationRefreshBar />
        </>
      )}
      {showPreview ? (
        <WebsitePreview />
      ) : onSimLab ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AppOutlet />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {onSettings ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppOutlet />
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1">
              <Sidebar />
              <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-app-canvas transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  collapsed ? "md:pl-14" : "md:pl-[17rem]"
                }`}
              >
                <MobileNav />
                <motion.main
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="flex-1 scroll-smooth px-4 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-3 lg:px-8"
                >
                  <AppOutlet />
                </motion.main>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  useEffect(() => {
    document.documentElement.classList.add("app-theme");
    return () => {
      document.documentElement.classList.remove("app-theme");
      document.documentElement.classList.remove("app-theme-dark");
      document.documentElement.style.removeProperty("color-scheme");
    };
  }, []);

  useDocumentRobots("noindex, nofollow");

  return (
    <AppThemeProvider>
      <CodebaseCommandPaletteProvider>
        <SidebarProvider>
          <WorkspaceModeProvider>
            <div className="app-shell app-shell-gradient min-h-screen text-app-ink">
              <GithubOAuthRedirect />
              <JiraOAuthRedirect />
              <IntakeAssignmentListener />
              <ProductTourController />
              <AppShellContent />
            </div>
          </WorkspaceModeProvider>
        </SidebarProvider>
      </CodebaseCommandPaletteProvider>
    </AppThemeProvider>
  );
}
