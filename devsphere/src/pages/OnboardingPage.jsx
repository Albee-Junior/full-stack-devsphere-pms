import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { ErrorState } from "../components/ui/AsyncState.jsx";

const steps = [
  { title: "What brings you to DevSphere?", field: "role", options: ["Student", "Business owner", "Freelancer", "Team member", "Educator", "Researcher"] },
  { title: "What kind of work do you do?", field: "industry", options: ["Student", "Business", "Freelancer", "Software", "Design", "Education", "Research", "Other"] },
  { title: "Set up your workspace rhythm", field: "workflow", options: ["Flexible", "Kanban", "Weekly planning", "Study schedule"] },
];

export default function OnboardingPage({ workspace, onSave }) {
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || "My workspace");
  const [role, setRole] = useState("Team member");
  const [industry, setIndustry] = useState("Other");
  const [teamSize, setTeamSize] = useState("Just me");
  const [workflow, setWorkflow] = useState("Flexible");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = steps[step];
  const selected = { role, industry, workflow }[current.field];
  const setSelected = { role: setRole, industry: setIndustry, workflow: setWorkflow }[current.field];

  async function continueSetup() {
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ workspaceName, role, industry, teamSize, workflow });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-page page-content">
      <div className="onboarding-brand"><span className="brand-symbol"><span /><span /><span /><span /></span><strong>devsphere<span>.</span></strong></div>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      <div className="onboarding-step"><span className="eyebrow">PERSONALIZE YOUR SPACE · STEP {step + 1} OF {steps.length}</span><h1>{current.title}</h1><p>We’ll shape your workspace around how you learn and work. You can change these choices later.</p>
        {step === 0
          ? <div className="onboarding-options">{current.options.map((option) => <button key={option} className={`onboarding-option ${selected === option ? "selected" : ""}`} onClick={() => setSelected(option)}>{option}{selected === option && <Check size={16} />}</button>)}</div>
          : step === 1
            ? <div className="onboarding-options">{current.options.map((option) => <button key={option} className={`onboarding-option ${selected === option ? "selected" : ""}`} onClick={() => setSelected(option)}>{option}{selected === option && <Check size={16} />}</button>)}</div>
            : <div className="onboarding-final"><label className="settings-label">Workspace name<input maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><label className="settings-label">People in this workspace<select value={teamSize} onChange={(event) => setTeamSize(event.target.value)}>{["Just me", "2–5", "6–15", "16–50", "51+"].map((size) => <option key={size}>{size}</option>)}</select></label><div className="onboarding-workflows">{current.options.map((option) => <button key={option} className={`onboarding-option ${selected === option ? "selected" : ""}`} onClick={() => setSelected(option)}>{option}{selected === option && <Check size={16} />}</button>)}</div></div>}
        <ErrorState error={error} />
        <div className="onboarding-actions">{step > 0 && <button className="button button-secondary" onClick={() => setStep((currentStep) => currentStep - 1)}><ArrowLeft size={15} /> Back</button>}<button className="button button-primary" disabled={saving || (step === 2 && workspaceName.trim().length < 2)} onClick={continueSetup}>{saving ? "Saving…" : step === steps.length - 1 ? "Finish setup" : "Continue"}{step === steps.length - 1 ? <Sparkles size={15} /> : <ArrowRight size={15} />}</button></div>
      </div>
    </main>
  );
}
