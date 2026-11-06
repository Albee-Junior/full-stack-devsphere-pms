import { BookOpenText, CreditCard, Files, LockKeyhole, Sparkles } from "lucide-react";
import PageHeading from "../components/ui/PageHeading.jsx";

const sections = [
  {
    title: "Start your workspace",
    icon: BookOpenText,
    steps: [
      "Create an account and choose your workspace name, role, and workflow in onboarding.",
      "Create a project, add tasks, and use the task board to track work from Todo to Done.",
      "Invite teammates from the workspace header. Invitations count toward your member limit.",
      "Use Groups for a focused class or client space. Extensions installs small tools; paid extensions require the matching plan.",
    ],
  },
  {
    title: "Files, folders, and code",
    icon: Files,
    steps: [
      "Open Files & folders to create folders, upload supported files, and browse saved work.",
      "Use the code icon beside a source file to open it in Code Studio; Save to files writes it back to the workspace.",
      "HTML and HTM can run in the isolated preview. Other source files are saved and downloaded but are not executed by the browser.",
    ],
  },
  {
    title: "Plans and workspace limits",
    icon: LockKeyhole,
    steps: [
      "Free includes 5 GB of storage, 5 projects, 100 tasks, 3 members, 250 files, and 50 folders.",
      "Pro includes 100 GB, up to 100 projects, 5,000 tasks, and up to 10 members. It unlocks AI, whiteboards, huddles, and contract drafts.",
      "Business includes 1 TB, up to 500 projects, 25,000 tasks, and up to 50 members. It also unlocks analytics and CRM.",
      "Limits are enforced by the API. Removing files frees storage; upgrading raises the applicable caps.",
    ],
  },
  {
    title: "Payments and subscription access",
    icon: CreditCard,
    steps: [
      "Choose Pro or Business on Pricing, select USD for Stripe card checkout or GHS for Paystack card/mobile money, then complete checkout on the provider's secure page.",
      "DevSphere activates paid workspace access after a verified provider webhook. Keep the browser open briefly after checkout while the confirmation status refreshes.",
      "USD subscriptions renew monthly. GHS payments grant 30 days and must be renewed manually. Use Billing activity to check payment records.",
      "Use Cancel plan on Pricing to request cancellation. Stripe access remains through the billing period; GHS access ends at the recorded expiry.",
    ],
  },
];

export default function HelpCenterPage({ onNavigate }) {
  return (
    <div className="page-content section-page help-center-page">
      <PageHeading eyebrow="DEVSPHERE GUIDE" title="Help & getting started" description="A practical guide to setting up your workspace, using the core tools, and managing a plan." />
      <div className="help-center-welcome panel">
        <span><Sparkles size={20} /></span>
        <div><strong>Welcome to DevSphere.</strong><p>Start with one project and a clear next task. Add collaboration tools when your workflow needs them.</p></div>
        <button type="button" className="button button-secondary" onClick={() => onNavigate("Pricing")}>View plans</button>
      </div>
      <div className="help-guide-grid">
        {sections.map(({ title, icon: Icon, steps }) => (
          <section className="panel help-guide-card" key={title}>
            <div><Icon size={18} /><h2>{title}</h2></div>
            <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol>
          </section>
        ))}
      </div>
    </div>
  );
}
