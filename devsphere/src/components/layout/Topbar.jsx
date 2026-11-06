import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, BookOpenText, BookOpenCheck, CalendarDays, ChartNoAxesCombined, ChevronRight, Command, ContactRound, CreditCard, FileStack, FileText, FolderKanban, LayoutDashboard, ListTodo, MessageSquare, Moon, Plus, Search, Settings, ShoppingBag, Sparkles, Sun, UsersRound, Video, CircleHelp, Puzzle } from "lucide-react";
import { get } from "../../api/http.js";
import Avatar from "../ui/Avatar.jsx";

const searchLinks = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My tasks", icon: ListTodo },
  { label: "Projects", icon: FolderKanban },
  { label: "Messages", icon: MessageSquare },
  { label: "Calendar", icon: CalendarDays },
  { label: "Community", icon: UsersRound },
  { label: "Blog & news", icon: BookOpenText },
  { label: "Code studio", icon: Command },
  { label: "Whiteboard", icon: Command },
  { label: "AI assistant", icon: Sparkles },
  { label: "Huddle", icon: Video },
  { label: "Settings", icon: Settings },
  { label: "Notifications", icon: Bell },
  { label: "Study hub", icon: BookOpenCheck },
  { label: "Contracts", icon: FileText },
  { label: "Resources", icon: ShoppingBag },
  { label: "Files & folders", icon: FileStack },
  { label: "Pricing", icon: CreditCard },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "CRM", icon: ContactRound },
  { label: "Help center", icon: CircleHelp },
  { label: "Groups", icon: UsersRound },
  { label: "Extensions", icon: Puzzle },
];

export default function Topbar({ activeView, workspace, user, onNavigate, onMenuOpen, onInvite }) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(document.documentElement.dataset.theme === "dark");
  const [unreadCount, setUnreadCount] = useState(0);
  const matches = useMemo(() => searchLinks.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    let active = true;
    const refresh = () => get("/notifications")
      .then(({ unreadCount: count }) => { if (active) setUnreadCount(count); })
      .catch(() => { if (active) setUnreadCount(0); });
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("devsphere:notifications-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("devsphere:notifications-updated", refresh);
    };
  }, [activeView]);

  function choose(label) {
    onNavigate(label);
    setQuery("");
    setSearchOpen(false);
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("devsphere-theme", next ? "dark" : "light");
  }

  return (
    <header className="topbar">
      <div className="topbar-left topbar__left">
        <button className="mobile-menu-button icon-button" onClick={onMenuOpen} aria-label="Open navigation"><Command size={17} /></button>
        <div className="breadcrumb"><span>{workspace?.name || "Workspace"}</span><ChevronRight size={14} /><strong>{activeView}</strong></div>
      </div>
      <div className="topbar-actions topbar__right">
        <div className="global-search topbar__search">
          <Search size={16} />
          <input
            aria-label="Search workspace"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) choose(matches[0].label);
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Search pages..."
          />
          <kbd><Command size={11} /> K</kbd>
          {searchOpen && <>
            <button className="search-dismiss" aria-label="Close search" onClick={() => setSearchOpen(false)} />
            <div className="search-results">
              {query && <span className="search-result-label">JUMP TO</span>}
              {(query ? matches : searchLinks.slice(0, 4)).map(({ label, icon: Icon }) => (
                <button key={label} onClick={() => choose(label)}><Icon size={15} />{label}<ArrowRight size={13} /></button>
              ))}
              {query && !matches.length && <span className="no-search-results">No matching pages.</span>}
            </div>
          </>}
        </div>
        <button className="upgrade-link" type="button" onClick={() => choose("Pricing")} aria-label="View DevSphere Pro pricing">
          <Sparkles size={14} /> Pro
        </button>
        <button className="topbar-icon icon-button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="topbar-icon icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => choose("Notifications")}><Bell size={17} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
        <span className="topbar-divider" />
        <button className="invite-button" onClick={onInvite}><Plus size={14} /> Invite</button>
        <div className="topbar-user"><Avatar name={user?.name || "Member"} size="small" /><span>{user?.name?.split(" ")[0] || "Member"}</span></div>
      </div>
    </header>
  );
}
