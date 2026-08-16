import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "../../shared/providers/useAuth";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import { PRODUCT_TOUR_STEPS } from "./productTourSteps";
import {
  PRODUCT_TOUR_START_EVENT,
  clearProductTourSeen,
  consumeProductTourPending,
  hasSeenProductTour,
  markProductTourSeen,
} from "./productTourStorage";
import "./productTour.css";

/** Delay before the tour starts so the dashboard has painted. */
const START_DELAY_MS = 900;
/** Delay between navigating to a step's route and moving the spotlight,
 * so the sidebar can expand sub-navigation for the new route. */
const STEP_MOVE_DELAY_MS = 150;

// Module-level tour state. The controller component can unmount/remount
// several times while the app boots (StrictMode double-mount, org bootstrap
// re-renders), so the pending start timer and the live driver instance must
// not be tied to a single component instance's lifecycle.
let activeController = null; // latest mounted instance's context
let activeDriver = null;
let startTimerId = null;
let wizardStartPending = false;

function destroyTour() {
  activeDriver?.destroy();
  activeDriver = null;
}

function resolveStepElement(step) {
  if (!step.target) return undefined;
  const primary = document.querySelector(`[data-tour="${step.target}"]`);
  if (primary) return primary;
  if (step.fallbackTarget) {
    const fallback = document.querySelector(`[data-tour="${step.fallbackTarget}"]`);
    if (fallback) return fallback;
  }
  // driver.js renders the popover centered when no element is found.
  return undefined;
}

function stepPath(ctx, step) {
  return step.segment ? ctx.orgPath(step.segment) : ctx.orgPath();
}

function finishTour() {
  markProductTourSeen(activeController?.userId);
  destroyTour();
}

function startTour() {
  const ctx = activeController;
  if (!ctx || activeDriver) return;
  wizardStartPending = false;
  if (ctx.collapsed) ctx.toggleCollapsed();

  const steps = PRODUCT_TOUR_STEPS.map((step) => ({
    element: () => resolveStepElement(step),
    popover: {
      title: step.title,
      description: step.body,
      side: step.target ? "right" : "over",
      align: "start",
    },
  }));

  activeDriver = driver({
    steps,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: "agentos-product-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Finish",
    onPopoverRender: (popover, { state }) => {
      const isLast = state.activeIndex === PRODUCT_TOUR_STEPS.length - 1;
      if (isLast) return;
      const skip = document.createElement("button");
      skip.type = "button";
      skip.innerText = "Skip tour";
      skip.classList.add("agentos-tour-skip");
      skip.addEventListener("click", finishTour);
      popover.footerButtons.prepend(skip);
    },
    onNextClick: () => {
      if (!activeDriver || !activeController) return;
      const idx = activeDriver.getActiveIndex() ?? 0;
      if (idx >= PRODUCT_TOUR_STEPS.length - 1) {
        finishTour();
        return;
      }
      activeController.navigate(stepPath(activeController, PRODUCT_TOUR_STEPS[idx + 1]));
      setTimeout(() => activeDriver?.moveNext(), STEP_MOVE_DELAY_MS);
    },
    onPrevClick: () => {
      if (!activeDriver || !activeController) return;
      const idx = activeDriver.getActiveIndex() ?? 0;
      if (idx <= 0) return;
      activeController.navigate(stepPath(activeController, PRODUCT_TOUR_STEPS[idx - 1]));
      setTimeout(() => activeDriver?.movePrevious(), STEP_MOVE_DELAY_MS);
    },
    // Fired by the ✕ button, overlay click, or Escape: treat as Skip so
    // the tour does not auto-restart on refresh.
    onDestroyStarted: () => {
      finishTour();
    },
  });

  activeController.navigate(stepPath(activeController, PRODUCT_TOUR_STEPS[0]));
  setTimeout(() => activeDriver?.drive(), STEP_MOVE_DELAY_MS);
}

function scheduleStart() {
  if (startTimerId != null || activeDriver) return;
  startTimerId = setTimeout(() => {
    startTimerId = null;
    startTour();
  }, START_DELAY_MS);
}

export default function ProductTourController() {
  const { user } = useAuth();
  const { orgPath } = useOrg();
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  // Register this instance as the active controller on every render so the
  // module-level callbacks always use fresh router hooks.
  const ctxRef = useRef({});
  ctxRef.current = { navigate, orgPath, userId: user?.id, collapsed, toggleCollapsed };
  activeController = ctxRef.current;

  useEffect(() => {
    activeController = ctxRef.current;
    return () => {
      if (activeController === ctxRef.current) activeController = null;
      // Tear down the overlay only if no controller re-registers shortly —
      // i.e. the app shell is really gone (logout), not just remounting.
      setTimeout(() => {
        if (!activeController) {
          destroyTour();
          if (startTimerId != null) {
            clearTimeout(startTimerId);
            startTimerId = null;
          }
        }
      }, 300);
    };
  }, []);

  // First-run: start after the wizard hand-off (nav state) or when this user
  // has never seen the tour.
  useEffect(() => {
    const fromWizardState = Boolean(location.state?.startProductTour);
    if (consumeProductTourPending()) wizardStartPending = true;
    if (fromWizardState) {
      wizardStartPending = true;
      // Clear the nav state so a refresh does not re-trigger the tour.
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    const unseen = !hasSeenProductTour(user?.id);
    if (fromWizardState || wizardStartPending || unseen) scheduleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, user?.id]);

  // Replay: TopBar dispatches this event to restart the tour on demand.
  useEffect(() => {
    function handleReplay() {
      clearProductTourSeen(ctxRef.current.userId);
      destroyTour();
      startTour();
    }
    window.addEventListener(PRODUCT_TOUR_START_EVENT, handleReplay);
    return () => window.removeEventListener(PRODUCT_TOUR_START_EVENT, handleReplay);
  }, []);

  return null;
}
