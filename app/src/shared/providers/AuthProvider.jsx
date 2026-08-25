import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authAdapter, hasStoredAuthToken, readStoredSession } from "../../entities/auth";
import { identifyUser, resetAnalytics } from "../analytics/mixpanel";
import AppPreloader from "../ui/AppPreloader";
import { AuthContext, useAuth } from "./useAuth";
import { sessionHomePath, migrateAppPath } from "../routing/orgPaths";

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => readStoredSession());
  const [loading, setLoading] = useState(() => hasStoredAuthToken());

  const refresh = useCallback(async () => {
    const next = await authAdapter.getSession();
    setSession(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!hasStoredAuthToken()) return;
        const next = await authAdapter.getSession();
        if (!cancelled) setSession(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const syncFromStorage = () => {
      void refresh();
    };

    window.addEventListener("storage", syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [refresh]);

  useEffect(() => {
    if (session?.user?.id) identifyUser(session);
  }, [session]);

  const login = useCallback(async (payload) => {
    const next = await authAdapter.login(payload);
    identifyUser(next);
    setSession(next);
    return next;
  }, []);

  const signup = useCallback(async (payload) => {
    const next = await authAdapter.signup(payload);
    identifyUser(next, { isNewSignup: true, signUpMethod: "email" });
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    resetAnalytics();
    navigate("/", { replace: true });
    await authAdapter.logout();
    setSession(null);
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      organization: session?.organization ?? null,
      loading,
      isAuthenticated: Boolean(session),
      hasOrganization: Boolean(
        session?.user?.organizationId ?? session?.organization?.id
      ),
      login,
      signup,
      logout,
      refresh,
      onboardingCompleted: session?.onboardingCompleted !== false,
    }),
    [session, loading, login, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireOnboardingComplete({ children }) {
  const { loading, isAuthenticated, onboardingCompleted, hasOrganization } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppPreloader overlay label="Checking session" />;
  }

  if (isAuthenticated && (!onboardingCompleted || !hasOrganization)) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppPreloader overlay label="Checking session" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { loading, isAuthenticated, onboardingCompleted, session } = useAuth();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowForm(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading && !showForm) {
    return <AppPreloader overlay label="Checking session" />;
  }

  if (isAuthenticated) {
    const target = onboardingCompleted
      ? sessionHomePath(session)
      : "/onboarding";
    return <Navigate to={target} replace />;
  }

  return children;
}
