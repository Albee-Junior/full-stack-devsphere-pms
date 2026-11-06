import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { get, post, remove } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";
import { useAuth } from "../hooks/useAuth.js";

function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { events: result } = await get("/events");
      setEvents(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    get("/events")
      .then(({ events: result }) => { if (active) { setEvents(result); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstMonday = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), 1 - firstMonday + index));
  }, [month]);

  const selectedEvents = events.filter((event) => {
    const date = new Date(event.startsAt);
    return date.getFullYear() === selectedDate.getFullYear()
      && date.getMonth() === selectedDate.getMonth()
      && date.getDate() === selectedDate.getDate();
  }).sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  async function createEvent(event) {
    event.preventDefault();
    try {
      const { event: created } = await post("/events", { title, description, startsAt: new Date(startsAt).toISOString() });
      setEvents((current) => [...current, created]);
      setSelectedDate(new Date(created.startsAt));
      setMonth(new Date(new Date(created.startsAt).getFullYear(), new Date(created.startsAt).getMonth(), 1));
      setTitle("");
      setDescription("");
      setShowForm(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteEvent(eventId) {
    try {
      await remove(`/events/${eventId}`);
      setEvents((current) => current.filter((event) => event.id !== eventId));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your calendar…" /></div>;

  return (
    <div className="page-content section-page">
      <PageHeading eyebrow="MAKE SPACE FOR GOOD WORK" title="Calendar" description="Your team's time, thoughtfully in sync." actions={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New event</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="calendar-layout">
        <article className="panel mini-calendar">
          <div className="mini-calendar-head"><h3>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3><div><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button><button className="icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button></div></div>
          <div className="calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index}>{day}</span>)}</div>
          <div className="calendar-days">{calendarDays.map((date) => {
            const sameDay = (first, second) => first.toDateString() === second.toDateString();
            const hasEvent = events.some((event) => sameDay(new Date(event.startsAt), date));
            const selected = sameDay(date, selectedDate);
            return <button key={date.toISOString()} className={`${selected ? "selected" : ""} ${sameDay(date, new Date()) ? "today" : ""} ${date.getMonth() !== month.getMonth() ? "outside" : ""}`} onClick={() => setSelectedDate(date)} aria-label={date.toLocaleDateString()}>{date.getDate()}<i className={hasEvent ? "has-event" : ""} /></button>;
          })}</div>
          <div className="calendar-key"><span><i className="key-violet" /> Workspace events</span><span>{events.length} scheduled</span></div>
        </article>
        <article className="panel agenda-panel">
          <div className="agenda-heading"><div><span className="eyebrow">YOUR DAY</span><h2>{selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2></div><button className="select-button" onClick={() => setSelectedDate(new Date())}>Today</button></div>
          <div className="agenda-timeline">{selectedEvents.map((event) => <article className="agenda-event" key={event.id}><time className="agenda-time">{new Date(event.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><div className="agenda-event-card agenda-violet"><div><strong>{event.title}</strong><span>{event.description || `Added by ${user?.name}`}</span></div><button className="icon-button" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event.id)}>×</button></div></article>)}{!selectedEvents.length && <div className="empty-panel"><CalendarDays size={22} /><p>A little breathing room. No events scheduled for this day.</p></div>}</div>
          <button className="add-task-link" onClick={() => { setStartsAt(toLocalInput(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 10))); setShowForm(true); }}><Plus size={15} /> Add an event</button>
        </article>
      </div>
      {showForm && <Dialog eyebrow="MAKE TIME FOR IT" title="Schedule an event" onClose={() => setShowForm(false)}><form onSubmit={createEvent}><label className="settings-label">Event name<input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Sprint retrospective" /></label><label className="settings-label">Details<input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional context for your team" /></label><label className="settings-label">Start time<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><div className="modal-footer"><span><CalendarDays size={14} /> Saved to your workspace</span><button className="button button-primary" type="submit" disabled={!title.trim()}><Plus size={15} /> Add event</button></div></form></Dialog>}
    </div>
  );
}
