import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, MessageSquare, Radio, Sparkles, Target } from "lucide-react";
import { get, patch } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const icons = { task: Target, message: MessageSquare, event: Radio, assistant: Sparkles };

export default function NotificationsPage({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await get("/notifications");
      setNotifications(result.notifications);
      setError("");
      window.dispatchEvent(new Event("devsphere:notifications-updated"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function markAllRead() {
    setSaving(true);
    setError("");
    try {
      await patch("/notifications/read-all", {});
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      window.dispatchEvent(new Event("devsphere:notifications-updated"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function openNotification(notification) {
    if (!notification.readAt) {
      try {
        await patch(`/notifications/${notification.id}/read`, {});
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
        window.dispatchEvent(new Event("devsphere:notifications-updated"));
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    onNavigate(notification.target || "Overview");
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your notifications…" /></div>;

  return (
    <div className="page-content section-page notification-page">
      <PageHeading eyebrow="YOUR WORKSPACE" title="Notifications" description="Keep up with the work and conversations that need your attention."
        actions={<button className="button button-secondary" disabled={saving || !notifications.some((item) => !item.readAt)} onClick={markAllRead}><CheckCheck size={15} /> Mark all read</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <section className="notification-list panel" aria-label="Recent notifications">
        {!notifications.length
          ? <div className="empty-panel"><Bell size={22} /><h2>You’re all caught up.</h2><p>Updates from your team will appear here.</p></div>
          : notifications.map((notification) => {
            const Icon = icons[notification.kind] || Bell;
            return (
              <button key={notification.id} className={`notification-row ${notification.readAt ? "" : "notification-unread"}`} onClick={() => openNotification(notification)}>
                <span className="notification-icon"><Icon size={17} /></span>
                <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span><time>{new Date(notification.createdAt).toLocaleString()}</time></span>
                {!notification.readAt && <i className="notification-unread-dot" aria-label="Unread" />}
              </button>
            );
          })}
      </section>
    </div>
  );
}
