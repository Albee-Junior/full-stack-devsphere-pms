import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, ExternalLink, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { get, post } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const planCopy = {
  free: {
    eyebrow: "GET STARTED",
    description: "A capable starter workspace for personal and small team projects.",
    highlights: ["5 GB file storage", "Up to 5 projects and 100 tasks", "10 AI assistant requests each day"],
  },
  pro: {
    eyebrow: "FOR GROWING WORK",
    description: "More room for active work, collaboration, and business tools.",
    highlights: ["100 GB file storage", "AI, whiteboard, huddles, and contract drafts", "Up to 10 workspace members"],
  },
  business: {
    eyebrow: "FOR TEAMS",
    description: "Advanced workspace capabilities and generous team limits.",
    highlights: ["1 TB file storage", "Analytics and CRM tools", "Up to 50 workspace members"],
  },
};

function formatStorage(bytes) {
  const gib = Number(bytes || 0) / (1024 ** 3);
  if (gib >= 1024) return `${(gib / 1024).toLocaleString(undefined, { maximumFractionDigits: 0 })} TB`;
  return `${gib.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB`;
}

function formatPrice(cents, currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function planLabel(planKey) {
  if (planKey?.startsWith("resource:")) return "Resource purchase";
  return planCopy[planKey] ? `${planKey[0].toUpperCase()}${planKey.slice(1)} plan` : "Workspace plan";
}

export default function PricingPage({ blockedFeature = "" }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [billingNotice, setBillingNotice] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    const [plansResult, historyResult] = await Promise.allSettled([
      get("/billing/plans"),
      get("/billing/history"),
    ]);

    if (plansResult.status === "fulfilled") {
      setData(plansResult.value);
      setError("");
    } else {
      setError(plansResult.reason.message);
    }

    if (historyResult.status === "fulfilled") {
      setHistory(historyResult.value.billing);
      setHistoryError("");
    } else {
      setHistoryError(historyResult.reason.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("billing");
    const reference = params.get("reference");
    if (outcome === "cancelled") {
      const timer = window.setTimeout(() => setBillingNotice("Checkout was cancelled. No payment was completed."), 0);
      return () => window.clearTimeout(timer);
    }
    if (!reference || !["success", "return"].includes(outcome)) return undefined;

    let active = true;
    let pollTimer;
    let timeoutTimer;
    const stopPolling = () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
    };
    const check = () => get(`/billing/status/${encodeURIComponent(reference)}`)
      .then(({ billing }) => {
        if (!active) return;
        if (billing.status === "paid") {
          setBillingMessage(`Payment confirmed. Your ${planLabel(billing.planKey)} is active.`);
          setBillingNotice("");
          stopPolling();
          void refresh();
        } else if (billing.status === "failed") {
          setBillingNotice("The payment was not completed. You can try checkout again.");
          stopPolling();
        } else {
          setBillingNotice("Your payment is processing. This page will check again shortly.");
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); });

    void check();
    pollTimer = window.setInterval(check, 5000);
    timeoutTimer = window.setTimeout(() => {
      window.clearInterval(pollTimer);
      if (active) setBillingNotice("Payment confirmation is taking longer than expected. Refresh your billing history in a moment.");
    }, 60000);
    return () => {
      active = false;
      stopPolling();
    };
  }, [refresh]);

  async function checkout(planKey) {
    setCheckoutPlan(planKey);
    setError("");
    try {
      const { checkoutUrl } = await post("/billing/checkout", { planKey, currency });
      const target = new URL(checkoutUrl);
      if (target.protocol !== "https:") throw new Error("The payment provider returned an invalid checkout link.");
      window.location.assign(target.href);
    } catch (requestError) {
      setError(requestError.message);
      setCheckoutPlan("");
    }
  }

  async function cancelSubscription() {
    if (!window.confirm("Cancel this workspace subscription? You will keep access until the current paid period ends when the provider supports it.")) return;
    setCancelling(true);
    setError("");
    try {
      await post("/billing/subscription/cancel", {});
      setBillingNotice("Your subscription cancellation was submitted.");
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading plans and billing history…" /></div>;

  const currentPlan = data?.current?.planKey || "free";
  const provider = data?.providers?.[currency.toLowerCase()];
  const providerName = provider?.name || (currency === "USD" ? "Stripe" : "Paystack");
  const plans = Array.isArray(data?.plans) ? data.plans : [];

  return (
    <div className="page-content section-page pricing-page">
      <PageHeading
        eyebrow="PLANS FOR YOUR NEXT CHAPTER"
        title="Straightforward pricing"
        description="Choose a workspace tier and keep your billing in one place. Prices are shown in the selected currency."
        actions={(
          <label className="pricing-currency">
            <span>Currency</span>
            <select aria-label="Pricing currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="USD">USD · US dollar</option>
              <option value="GHS">GHS · Ghana cedi</option>
            </select>
          </label>
        )}
      />

      {billingMessage && <div className="billing-result billing-success" role="status"><Check size={16} />{billingMessage}</div>}
      {billingNotice && <div className="billing-result" role="status"><LoaderCircle size={16} />{billingNotice}</div>}
      {blockedFeature && <div className="billing-result" role="status">{blockedFeature} requires the {["Analytics", "CRM"].includes(blockedFeature) ? "Business" : "Pro"} plan. Choose a matching plan to unlock it.</div>}
      <ErrorState error={error} onRetry={refresh} />

      <div className="pricing-provider-note panel">
        <CreditCard size={19} />
        <div>
          <strong>{currency === "USD" ? "Pay securely with Stripe" : "Pay securely with Paystack"}</strong>
          <p>
            {currency === "USD"
              ? "USD checkout supports eligible cards and renews monthly."
              : "GHS checkout may offer cards and mobile money when enabled for the merchant account."}
            {" "}Checkout opens on the provider's secure payment page.
          </p>
        </div>
      </div>

      <div className="pricing-current-summary panel">
        <span className="pricing-current-icon"><Sparkles size={17} /></span>
        <span><strong>Your current tier</strong><small>{planLabel(currentPlan)} · {data?.current?.status || "active"}</small></span>
        {data?.current?.expiresAt && <small className="pricing-expiry">Access through {formatDate(data.current.expiresAt)}</small>}
        {data?.current?.cancelAtPeriodEnd && <small className="pricing-expiry">Cancellation scheduled</small>}
        {currentPlan !== "free" && !data?.current?.cancelAtPeriodEnd && (
          <button type="button" className="text-button pricing-cancel" disabled={cancelling} onClick={cancelSubscription}>
            <XCircle size={14} /> {cancelling ? "Cancelling…" : "Cancel plan"}
          </button>
        )}
      </div>

      {data?.usage && (
        <section className="pricing-usage panel" aria-label="Workspace plan usage">
          <div className="pricing-usage-heading">
            <div><span className="eyebrow">WORKSPACE USAGE</span><h2>Storage</h2></div>
            <strong>{formatStorage(data.usage.storageBytes)} of {formatStorage(data.usage.storageLimitBytes)}</strong>
          </div>
          <div className="storage-meter" role="progressbar"
            aria-label="Storage used"
            aria-valuenow={Math.min(100, Math.round((data.usage.storageBytes / data.usage.storageLimitBytes) * 100))}
            aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${Math.min(100, Math.round((data.usage.storageBytes / data.usage.storageLimitBytes) * 100))}%` }} />
          </div>
          <p>Files: {data.usage.files} · Folders: {data.usage.folders}</p>
        </section>
      )}

      <div className="pricing-grid">
        {plans.map((plan) => {
          const copy = planCopy[plan.key] || planCopy.free;
          const cents = currency === "USD" ? plan.usdMonthlyCents : plan.ghsMonthlyCents;
          const active = plan.key === currentPlan;
          const configured = plan.key === "free" || Boolean(provider?.configured);

          return (
            <article className={`pricing-card panel ${plan.key === "pro" ? "pricing-card-featured" : ""}`} key={plan.key}>
              {plan.key === "pro" && <span className="pricing-popular"><Sparkles size={12} /> MOST POPULAR</span>}
              <span className="eyebrow">{copy.eyebrow}</span>
              <h2>{plan.name}</h2>
              <p>{copy.description}</p>
              <div className="pricing-price">
                <strong>{cents === 0 ? "Free" : formatPrice(cents, currency)}</strong>
                {cents > 0 && <span>{currency === "GHS" ? "per 30 days" : "per month"}</span>}
              </div>
              <ul>{copy.highlights.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
              <p className="plan-limit-details">
                {formatStorage(plan.storageBytes)} storage · {Number(plan.maxProjects).toLocaleString()} projects ·
                {" "}{Number(plan.maxTasks).toLocaleString()} tasks · {Number(plan.maxMembers).toLocaleString()} members ·
                {" "}{Number(plan.maxFiles).toLocaleString()} files · {Number(plan.maxFolders).toLocaleString()} folders ·
                {" "}{Number(plan.maxGroups).toLocaleString()} groups · {Number(plan.dailyAiRequests).toLocaleString()} AI requests/day
              </p>
              {active ? (
                <button className="button button-secondary pricing-action" disabled aria-current="true">Current plan</button>
              ) : plan.key === "free" ? (
                <button className="button button-secondary pricing-action" disabled>Included for everyone</button>
              ) : currentPlan !== "free" ? (
                <button className="button button-secondary pricing-action" disabled>
                  {data?.current?.cancelAtPeriodEnd ? "Available after current period" : "Current plan is active"}
                </button>
              ) : (
                <button
                  className="button button-primary pricing-action"
                  disabled={!configured || Boolean(checkoutPlan)}
                  onClick={() => checkout(plan.key)}
                >
                  {checkoutPlan === plan.key ? "Opening secure checkout…" : configured ? `Continue with ${providerName}` : `${providerName} not configured`}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <p className="pricing-disclosure">
        Free includes core project and collaboration features with explicit usage limits. Pro unlocks AI, whiteboards, huddles, and contract drafts; Business also unlocks analytics and CRM. USD subscriptions renew monthly. GHS subscriptions grant 30 days and require manual renewal. Seller payouts, tax calculation, and refunds are not part of this checkout setup.
      </p>

      <section className="pricing-history panel" aria-labelledby="billing-history-title">
        <div className="pricing-section-heading">
          <div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="billing-history-title">Billing activity</h2></div>
          <button type="button" className="text-button" onClick={() => { void refresh(); }}>Refresh history</button>
        </div>
        {historyError ? <ErrorState error={historyError} onRetry={refresh} /> : history.length ? (
          <div className="billing-history-list">
            {history.map((item) => (
              <div className="billing-history-row" key={item.id}>
                <span className="billing-history-icon"><CreditCard size={16} /></span>
                <span className="billing-history-description"><strong>{planLabel(item.planKey)}</strong><small>{item.provider} · {formatDate(item.createdAt)}</small></span>
                <span className={`billing-status billing-status-${item.status}`}>{item.status}</span>
                <strong className="billing-history-amount">{formatPrice(item.amountCents, item.currency.toUpperCase())}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="billing-history-empty"><CreditCard size={19} /><p>No billing activity yet. Completed or pending checkouts will appear here.</p></div>
        )}
      </section>

      <section className="pricing-faq" aria-labelledby="pricing-faq-title">
        <div className="pricing-section-heading"><div><span className="eyebrow">GOOD TO KNOW</span><h2 id="pricing-faq-title">Pricing questions</h2></div></div>
        <details><summary>Which payment methods are available?</summary><p>USD checkout uses Stripe for eligible cards. GHS checkout uses Paystack and can offer cards or mobile money when your merchant account is enabled for those channels.</p></details>
        <details><summary>How does GHS renewal work?</summary><p>GHS payments provide 30 days of access and need to be renewed manually. Recurring mobile-money billing is not enabled.</p></details>
        <details><summary>What is included in the free plan?</summary><p>Free workspaces include 5 GB of storage, up to 5 projects, 100 tasks, 3 members, 250 files, and 50 folders. AI assistant requests are limited to 10 per day. Paid features show an upgrade prompt.</p></details>
        <details><summary>What happens when I reach a storage or feature limit?</summary><p>The API blocks the new operation and keeps existing workspace data intact. Upgrade your plan for a higher quota. Deleting files frees storage after the file record is removed.</p></details>
        <details><summary>How do I cancel?</summary><p>Use Cancel plan on this page. Stripe subscriptions remain active until the paid period ends; GHS Paystack plans expire after 30 days and must be renewed manually.</p></details>
      </section>

      <p className="pricing-renewal-note"><ExternalLink size={14} /> Payment processing requires provider credentials and verified webhooks in the backend environment. Use test credentials before enabling live checkout.</p>
    </div>
  );
}
