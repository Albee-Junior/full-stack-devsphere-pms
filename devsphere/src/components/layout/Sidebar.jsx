import {
  Activity,
  BookOpenText,
  BookOpenCheck,
  CalendarDays,
  CircleHelp,
  Code2,
  CreditCard,
  ChartNoAxesCombined,
  FileStack,
  FileText,
  ContactRound,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  LayoutDashboard,
  LockKeyhole,
  ListTodo,
  MessageSquare,
  Bell,
  MousePointer2,
  Settings,
  Sparkles,
  ShoppingBag,
  Puzzle,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";
import Avatar from "../ui/Avatar.jsx";

const mainLinks = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My tasks", icon: ListTodo },
  { label: "Projects", icon: FolderKanban },
  { label: "Messages", icon: MessageSquare },
  { label: "Calendar", icon: CalendarDays },
  { label: "Notifications", icon: Bell },
  { label: "Files & folders", icon: FileStack },
];

const collaborationLinks = [
  { label: "Community", icon: UsersRound },
  { label: "Groups", icon: UsersRound },
  { label: "Blog & news", icon: BookOpenText },
];

const toolLinks = [
  { label: "Code studio", icon: Code2 },
  { label: "Whiteboard", icon: MousePointer2, feature: "whiteboard" },
  { label: "AI assistant", icon: Sparkles, accent: true },
  { label: "Huddle", icon: Video, feature: "huddle" },
  { label: "Study hub", icon: BookOpenCheck },
  { label: "Student dashboard", icon: GraduationCap },
  { label: "Contracts", icon: FileText, feature: "contracts" },
  { label: "Analytics", icon: ChartNoAxesCombined, feature: "analytics" },
  { label: "CRM", icon: ContactRound, feature: "crm" },
  { label: "Extensions", icon: Puzzle },
  { label: "Resources", icon: ShoppingBag },
  { label: "Pricing", icon: CreditCard },
  { label: "Help center", icon: CircleHelp },
];

function NavigationGroup({ links, activeView, onNavigate, plan }) {
  return (
    <nav className="primary-nav sidebar__section">
      {links.map(({ label, icon: Icon, accent, feature }) => {
        const locked = Boolean(feature && plan && !plan.features?.includes(feature));
        const requiredPlan = ["analytics", "crm"].includes(feature) ? "Business" : "Pro";
        return (
        <button
          key={label}
          className={`nav-item sidebar__link ${activeView === label ? "active sidebar__link--active" : ""} ${accent ? "nav-ai" : ""} ${locked ? "nav-item-locked" : ""}`}
          onClick={() => onNavigate(label)}
          aria-label={locked ? `${label} (${requiredPlan})` : label}
        >
          <Icon className="sidebar__link-icon" size={17} strokeWidth={1.8} />
          <span className="sidebar__link-label">{label}</span>
          {locked && <LockKeyhole className="nav-lock" size={13} aria-hidden="true" />}
        </button>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ activeView, onNavigate, workspace, user, plan, onLogout, open, onClose }) {
  const [footerExpanded, setFooterExpanded] = useState(
    () => activeView === "Settings" || activeView === "Help center",
  );

  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-topline">
          <button className="brand-lockup" onClick={() => onNavigate("Overview")} aria-label="DevSphere home">
            <img className="logo-light" src="/prototype/assets/logo/devsphere-logo.svg" alt="" />
            <img className="logo-dark" src="/prototype/assets/logo/devsphere-logo-dark.svg" alt="" />
          </button>
          <button className="icon-button sidebar-mobile-close" aria-label="Close navigation" onClick={onClose}><X size={17} /></button>
        </div>
        <button className="workspace-switch workspace-switcher" onClick={() => onNavigate("Settings")}>
          <span className="workspace-logo workspace-switcher__avatar">{workspace?.name?.slice(0, 1) || "D"}</span>
          <span className="workspace-name workspace-switcher__name"><strong>{workspace?.name || "Your workspace"}</strong><small>{plan?.name || "Workspace"} plan</small></span>
          <span className="workspace-switch-caret">⌄</span>
        </button>
        <div className="sidebar-scroll sidebar__nav">
          <span className="sidebar-section-label sidebar__section-label">WORKSPACE</span>
          <NavigationGroup links={mainLinks} activeView={activeView} onNavigate={onNavigate} plan={plan} />
          <div className="sidebar-section-heading"><span className="sidebar-section-label sidebar__section-label">COMMUNITY</span></div>
          <NavigationGroup links={collaborationLinks} activeView={activeView} onNavigate={onNavigate} plan={plan} />
          <div className="sidebar-section-heading"><span className="sidebar-section-label sidebar__section-label">YOUR TOOLS</span></div>
          <NavigationGroup links={toolLinks} activeView={activeView} onNavigate={onNavigate} plan={plan} />
        </div>
        <div className="sidebar-bottom sidebar__footer">
          <button
            type="button"
            className="sidebar-footer-toggle"
            aria-expanded={footerExpanded}
            aria-controls="sidebar-footer-details"
            onClick={() => setFooterExpanded((expanded) => !expanded)}
          >
            {footerExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span>{footerExpanded ? "Collapse account & support" : "Show account & support"}</span>
          </button>
          {footerExpanded && (
            <div className="sidebar-footer-details" id="sidebar-footer-details">
              <div className="sidebar-help-note"><Activity size={14} /><span>Workspace data syncs automatically.</span></div>
              <button className={`nav-item sidebar__link sidebar-settings ${activeView === "Settings" ? "active sidebar__link--active" : ""}`} onClick={() => { setFooterExpanded(true); onNavigate("Settings"); }}><Settings className="sidebar__link-icon" size={17} /><span className="sidebar__link-label">Settings</span></button>
              <button className={`nav-item sidebar__link ${activeView === "Help center" ? "active sidebar__link--active" : ""}`} onClick={() => { setFooterExpanded(true); onNavigate("Help center"); }}><CircleHelp className="sidebar__link-icon" size={17} /><span className="sidebar__link-label">Help &amp; support</span></button>
              <button className="sidebar-profile" onClick={onLogout} title="Sign out">
                <Avatar name={user?.name || "Member"} />
                <span><strong>{user?.name || "Member"}</strong><small>Sign out</small></span>
                <span className="profile-signout">↗</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
