import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { get } from "../api/http.js";
import { useAuth } from "../hooks/useAuth.js";
import { ErrorState } from "../components/ui/AsyncState.jsx";

export default function AuthPage({ onBack, initialMode = "login" }) {
  const { login, register } = useAuth();
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [mode, setMode] = useState(inviteToken ? "register" : initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteToken ? "" : "demo@devsphere.local");
  const [password, setPassword] = useState("devsphere123");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteWorkspace, setInviteWorkspace] = useState("");

  useEffect(() => {
    if (!inviteToken) return undefined;
    let active = true;
    get(`/auth/invitations/${encodeURIComponent(inviteToken)}`)
      .then(({ invitation }) => {
        if (!active) return;
        setEmail(invitation.email);
        setInviteWorkspace(invitation.workspaceName);
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [inviteToken]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "register") await register(name, email, password, inviteToken || undefined);
      else await login(email, password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <button type="button" className="auth-brand" onClick={onBack} aria-label="Back to DevSphere home"><img src="/prototype/assets/logo/devsphere-logo.svg" alt="" /></button>
        <div className="auth-hero"><span className="auth-hero-icon"><Sparkles size={19} /></span><span className="eyebrow">YOUR TEAM, IN SYNC</span><h1>Make good work<br />feel a little easier.</h1><p>One thoughtful workspace for your projects, conversations, and the ideas that move you forward.</p></div>
        <div className="auth-aside-footer"><span className="online-dot" /> A calmer way to build, together.</div>
      </section>
      <section className="auth-main">
        <div className="auth-form-wrap">
          <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
          <h2>{mode === "login" ? "Good to see you." : inviteWorkspace ? `Join ${inviteWorkspace}.` : "Create your workspace."}</h2>
          <p>{mode === "login" ? "Sign in to pick up where your team left off." : "Set up your account and bring your team together."}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <label className="settings-label">Your name<input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" /></label>}
            <label className="settings-label">Email address<input autoComplete="email" type="email" required maxLength={160} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
            <label className="settings-label">Password<span className="password-input"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <ErrorState error={error} />
            <button type="submit" className="button button-primary auth-submit" disabled={saving}>{saving ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={15} /></button>
          </form>
          <div className="auth-switch">{mode === "login" ? "New to DevSphere?" : "Already have an account?"}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}> {mode === "login" ? "Create an account" : "Sign in"}</button></div>
          {mode === "login" && <div className="demo-hint"><strong>Demo workspace</strong><span>demo@devsphere.local</span><span>devsphere123</span><button onClick={() => { setEmail("demo@devsphere.local"); setPassword("devsphere123"); }}>Use demo credentials</button></div>}
          <span className="auth-privacy">Your workspace is private. Account data stays in your local database.</span>
        </div>
      </section>
    </main>
  );
}
