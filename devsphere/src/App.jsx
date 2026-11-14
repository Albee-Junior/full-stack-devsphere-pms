import { useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import ProjectForm from "./components/projects/ProjectForm.jsx";
import TaskForm from "./components/tasks/TaskForm.jsx";
import InviteDialog from "./components/workspace/InviteDialog.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { get } from "./api/http.js";
import AssistantPage from "./pages/AssistantPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import CodeStudioPage from "./pages/CodeStudioPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HuddlePage from "./pages/HuddlePage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import WhiteboardPage from "./pages/WhiteboardPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import ContractsPage from "./pages/ContractsPage.jsx";
import FilesPage from "./pages/FilesPage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import ResourcesPage from "./pages/ResourcesPage.jsx";
import StudyHubPage from "./pages/StudyHubPage.jsx";
import StudentDashboardPage from "./pages/StudentDashboardPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import CRMPage from "./pages/CRMPage.jsx";
import HelpCenterPage from "./pages/HelpCenterPage.jsx";
import GroupsPage from "./pages/GroupsPage.jsx";
import ExtensionsPage from "./pages/ExtensionsPage.jsx";
import { LoadingState } from "./components/ui/AsyncState.jsx";
import BrandMark from "./components/ui/BrandMark.jsx";

const pageComponents = {
  Overview: DashboardPage,
  "My tasks": TasksPage,
  Projects: ProjectsPage,
  Messages: MessagesPage,
  Calendar: CalendarPage,
  Community: CommunityPage,
  "Blog & news": BlogPage,
  "Code studio": CodeStudioPage,
  Whiteboard: WhiteboardPage,
  "AI assistant": AssistantPage,
  Huddle: HuddlePage,
  Settings: SettingsPage,
  Notifications: NotificationsPage,
  "Study hub": StudyHubPage,
  "Student dashboard": StudentDashboardPage,
  Contracts: ContractsPage,
  Resources: ResourcesPage,
  "Files & folders": FilesPage,
  Pricing: PricingPage,
  Analytics: AnalyticsPage,
  CRM: CRMPage,
  "Help center": HelpCenterPage,
  Groups: GroupsPage,
  Extensions: ExtensionsPage,
};

const featureByView = {
  Whiteboard: "whiteboard",
  Contracts: "contracts",
  Huddle: "huddle",
  Analytics: "analytics",
  CRM: "crm",
};

export default function App() {
  const { user, workspace, loading, logout, saveWorkspacePreferences } = useAuth();
  const [workspaceAccess, setWorkspaceAccess] = useState(null);
  const [blockedFeature, setBlockedFeature] = useState("");
  const [pendingLandingView, setPendingLandingView] = useState("");
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).has("billing")
    ? "Pricing"
    : new URLSearchParams(window.location.search).get("view") || "Overview");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [showAuth, setShowAuth] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return query.has("invite") || query.has("billing");
  });
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    const savedTheme = localStorage.getItem("devsphere-theme");
    if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.all([get("/workspace/preferences"), get("/workspace/usage")])
      .then(([{ preferences }, access]) => {
        if (active) {
          setOnboarding({ userId: user.id, required: !preferences.onboardingCompleted });
          setWorkspaceAccess(access);
        }
      })
      .catch((requestError) => {
        if (active) {
          setOnboarding({ userId: user.id, required: false });
          setWorkspaceAccess({ error: requestError.message });
        }
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || onboarding?.userId !== user.id || onboarding.required || !pendingLandingView) return;
    const timer = window.setTimeout(() => {
      setActiveView(pendingLandingView);
      setBlockedFeature("");
      setPendingLandingView("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, onboarding, pendingLandingView]);

  useEffect(() => {
    if (!workspaceAccess?.plan) return;
    const gatedFeature = featureByView[activeView];
    if (gatedFeature && !workspaceAccess.plan.features.includes(gatedFeature)) {
      const timer = window.setTimeout(() => {
        setBlockedFeature(activeView);
        setActiveView("Pricing");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeView, workspaceAccess]);

  function navigateToView(label) {
    const gatedFeature = featureByView[label];
    if (gatedFeature && workspaceAccess && !workspaceAccess.error
      && !workspaceAccess.plan.features.includes(gatedFeature)) {
      setBlockedFeature(label);
      setActiveView("Pricing");
      return;
    }
    setBlockedFeature("");
    setActiveView(label);
  }

  if (loading) return <div className="app-loading"><BrandMark className="app-loading-brand" /><LoadingState label="Connecting to DevSphere…" /></div>;
  if (!user) {
    return showAuth
      ? <AuthPage initialMode={authMode} onBack={() => setShowAuth(false)} />
      : <LandingPage
        onGetStarted={() => { setAuthMode("register"); setShowAuth(true); }}
        onSignIn={() => { setAuthMode("login"); setShowAuth(true); }}
        onNavigate={(view) => {
          setPendingLandingView(view);
          setAuthMode("login");
          setShowAuth(true);
        }}
      />;
  }
  if (onboarding?.userId !== user.id) return <div className="app-loading"><LoadingState label="Preparing your workspace…" /></div>;
  if (onboarding.required) return <OnboardingPage workspace={workspace} onSave={async (preferences) => {
    await saveWorkspacePreferences(preferences);
    setOnboarding({ userId: user.id, required: false });
    setActiveView(pendingLandingView || "Overview");
    setPendingLandingView("");
  }} />;

  const ActivePage = pageComponents[activeView] || DashboardPage;

  return (
    <>
      <AppShell
        activeView={activeView}
        onNavigate={(label) => navigateToView(pageComponents[label] ? label : "Overview")}
        workspace={workspace}
        user={user}
        plan={workspaceAccess?.plan}
        onLogout={() => { logout(); setActiveView("Overview"); }}
        onInvite={() => setShowInviteForm(true)}
      >
        {activeView === "Overview"
          ? <DashboardPage
            onNavigate={navigateToView}
            onAddTask={() => setShowTaskForm(true)}
            onCreateProject={() => setShowProjectForm(true)}
          />
          : activeView === "Notifications"
            ? <NotificationsPage onNavigate={navigateToView} />
            : activeView === "Pricing"
              ? <PricingPage blockedFeature={blockedFeature} />
              : <ActivePage onNavigate={navigateToView} />}
      </AppShell>
      {showTaskForm && <TaskForm projects={[]} onClose={() => setShowTaskForm(false)} onCreated={() => setShowTaskForm(false)} />}
      {showProjectForm && <ProjectForm onClose={() => setShowProjectForm(false)} onCreated={() => setShowProjectForm(false)} />}
      {showInviteForm && <InviteDialog onClose={() => setShowInviteForm(false)} />}
    </>
  );
}
