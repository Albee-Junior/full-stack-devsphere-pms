import { useCallback, useEffect, useMemo, useState } from "react";
import { get, post, put, saveToken } from "../api/http.js";
import AuthContext from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("devsphere-token")));

  useEffect(() => {
    const handleUnauthorized = () => {
      saveToken(null);
      setUser(null);
      setWorkspace(null);
    };
    window.addEventListener("devsphere:unauthorized", handleUnauthorized);
    if (!localStorage.getItem("devsphere-token")) {
      return () => window.removeEventListener("devsphere:unauthorized", handleUnauthorized);
    }
    let active = true;
    get("/auth/me")
      .then(({ user: currentUser, workspace: currentWorkspace }) => {
        if (!active) return;
        setUser(currentUser);
        setWorkspace(currentWorkspace);
      })
      .catch(() => { saveToken(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      window.removeEventListener("devsphere:unauthorized", handleUnauthorized);
    };
  }, []);

  const authenticate = useCallback(async (endpoint, details) => {
    const result = await post(`/auth/${endpoint}`, details);
    saveToken(result.token);
    const identity = await get("/auth/me");
    setUser(identity.user);
    setWorkspace(identity.workspace);
    return identity.user;
  }, []);

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
    setWorkspace(null);
  }, []);

  const saveWorkspacePreferences = useCallback(async (preferences) => {
    const result = await put("/workspace/preferences", preferences);
    setWorkspace((current) => current ? { ...current, name: result.preferences.workspaceName } : current);
    return result.preferences;
  }, []);

  const value = useMemo(() => ({
    user,
    workspace,
    loading,
    login: (email, password) => authenticate("login", { email, password }),
    register: (name, email, password, inviteToken) => authenticate("register", { name, email, password, inviteToken }),
    saveWorkspacePreferences,
    logout,
  }), [user, workspace, loading, authenticate, saveWorkspacePreferences, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
