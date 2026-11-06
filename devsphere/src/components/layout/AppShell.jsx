import { useState } from "react";
import { Sparkles } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function AppShell({ activeView, onNavigate, workspace, user, plan, onLogout, onInvite, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Topbar
        activeView={activeView}
        workspace={workspace}
        user={user}
        onNavigate={onNavigate}
        onMenuOpen={() => setSidebarOpen(true)}
        onInvite={onInvite}
      />
      <Sidebar
        activeView={activeView}
        onNavigate={(label) => { onNavigate(label); setSidebarOpen(false); }}
        workspace={workspace}
        user={user}
        plan={plan}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-area app-main" id="main-content">
        <div className="main-scroll">{children}</div>
        <footer className="app-footer">
          <span>Made for teams that care about the details.</span>
          <span><i className="footer-online" /> Connected to your workspace API <span className="footer-dot">·</span><button onClick={() => onNavigate("AI assistant")}><Sparkles size={12} /> DevSphere AI</button></span>
        </footer>
      </main>
    </div>
  );
}
