import { randomUUID, timingSafeEqual, createHmac } from "node:crypto";
import Stripe from "stripe";
import { config } from "../config.js";
import { db, withTransaction } from "../db/database.js";
import { httpError } from "../middleware/errors.js";
import { planDefinitions } from "./planAccess.js";

const plans = {
  free: { name: "Free", usd: 0, ghs: 0 },
  pro: { name: "Pro", usd: 800, ghs: 10000 },
  business: { name: "Business", usd: 1600, ghs: 20000 },
};

function isValidSignature(secret, signature, rawBody, algorithm) {
  if (!secret || !signature || !rawBody) return false;
  const expected = createHmac(algorithm, secret).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function createCheckout({ user, currency, planKey, resource }) {
  const normalizedCurrency = String(currency || resource?.currency || "USD").toUpperCase();
  if (!["USD", "GHS"].includes(normalizedCurrency)) throw httpError(400, "Choose USD or GHS.");
  if (resource && resource.currency.toUpperCase() !== normalizedCurrency) {
    throw httpError(400, "Choose the currency listed for this resource.");
  }
  const plan = plans[planKey];
  if (!resource && (!plan || planKey === "free")) throw httpError(400, "Choose a paid plan.");
  if (!resource) {
    const activeSubscription = await db.prepare(`
      SELECT plan_key AS "planKey", expires_at AS "expiresAt"
      FROM workspace_subscriptions
      WHERE workspace_id = ? AND status = 'active' AND plan_key <> 'free'
    `).get(user.workspaceId);
    if (activeSubscription
      && (!activeSubscription.expiresAt || new Date(activeSubscription.expiresAt).getTime() > Date.now())) {
      throw httpError(409, "Your workspace already has an active paid plan. Cancel it or wait for its current billing period to end before starting another plan.");
    }
  }
  const amountCents = resource ? Number(resource.priceCents) : plan[normalizedCurrency.toLowerCase()];
  if (amountCents <= 0) throw httpError(400, "This item is free and does not need checkout.");

  const provider = normalizedCurrency === "USD" ? "stripe" : "paystack";
  if (provider === "stripe" && !config.stripeSecretKey) {
    throw httpError(503, "USD card checkout is not configured. Add STRIPE_SECRET_KEY to the backend environment.");
  }
  if (provider === "paystack" && !config.paystackSecretKey) {
    throw httpError(503, "GHS card and mobile-money checkout is not configured. Add PAYSTACK_SECRET_KEY to the backend environment.");
  }
  const billingReference = randomUUID();
  const billingKey = resource ? `resource:${resource.id}` : planKey;
  await db.prepare(`
    INSERT INTO billing_records (workspace_id, user_id, provider, provider_reference, plan_key, currency, amount_cents, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(user.workspaceId, user.id, provider, billingReference, billingKey, normalizedCurrency.toLowerCase(), amountCents);

  try {
    if (provider === "stripe") {
      const stripe = new Stripe(config.stripeSecretKey);
      const metadata = {
        billingReference,
        workspaceId: String(user.workspaceId),
        userId: String(user.id),
        planKey: billingKey,
      };
      const session = await stripe.checkout.sessions.create({
        mode: resource ? "payment" : "subscription",
        customer_email: user.email,
        client_reference_id: billingReference,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: resource?.title || `${plan.name} plan`, description: resource?.description || "Monthly DevSphere plan" },
            ...(resource ? {} : { recurring: { interval: "month" } }),
          },
        }],
        success_url: `${config.publicAppUrl}/?billing=success&reference=${encodeURIComponent(billingReference)}`,
        cancel_url: `${config.publicAppUrl}/?billing=cancelled`,
        metadata,
        ...(resource ? {} : { subscription_data: { metadata } }),
      });
      return { checkoutUrl: session.url, provider, reference: billingReference };
    }

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: amountCents,
        currency: normalizedCurrency,
        reference: billingReference,
        channels: ["card", "mobile_money"],
        callback_url: `${config.publicAppUrl}/?billing=return&reference=${encodeURIComponent(billingReference)}`,
        metadata: {
          workspaceId: user.workspaceId,
          userId: user.id,
          planKey: billingKey,
          custom_fields: [{ display_name: "Workspace", variable_name: "workspace", value: String(user.workspaceId) }],
        },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      throw httpError(502, result.message || "The payment provider could not start checkout.");
    }
    return { checkoutUrl: result.data.authorization_url, provider, reference: billingReference };
  } catch (error) {
    await db.prepare("UPDATE billing_records SET status = 'failed' WHERE provider_reference = ?").run(billingReference);
    if (error.status) throw error;
    console.error("Payment checkout initialization failed:", error);
    throw httpError(502, "Could not start checkout. Please try again later.");
  }
}

export async function completePayment(provider, reference, subscriptionId = null) {
  if (!reference || typeof reference !== "string") return;
  await withTransaction(async ({ query }) => {
    const record = await query(
      "SELECT id, workspace_id, user_id, plan_key, currency, status FROM billing_records WHERE provider = $1 AND provider_reference = $2 FOR UPDATE",
      [provider, reference],
    );
    const billing = record.rows[0];
    if (!billing || billing.status === "paid") return;
    await query("UPDATE billing_records SET status = 'paid' WHERE id = $1", [billing.id]);
    if (billing.plan_key.startsWith("resource:")) {
      const resourceId = Number(billing.plan_key.slice("resource:".length));
      await query(
        "INSERT INTO resource_sales (resource_id, buyer_id, billing_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [resourceId, billing.user_id, billing.id],
      );
    } else {
      await query(`
        INSERT INTO workspace_subscriptions (
          workspace_id, plan_key, status, currency, provider_reference, provider_subscription_id, expires_at, updated_at
        )
        VALUES ($1, $2, 'active', $3, $4, $5,
          CASE WHEN $3 = 'ghs' THEN CURRENT_TIMESTAMP + INTERVAL '1 month' ELSE NULL END,
          CURRENT_TIMESTAMP)
        ON CONFLICT(workspace_id) DO UPDATE SET plan_key = EXCLUDED.plan_key, status = 'active',
          currency = EXCLUDED.currency, provider_reference = EXCLUDED.provider_reference,
          provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, workspace_subscriptions.provider_subscription_id),
          cancel_at_period_end = FALSE,
          expires_at = EXCLUDED.expires_at, updated_at = CURRENT_TIMESTAMP
      `, [billing.workspace_id, billing.plan_key, billing.currency, reference, billing.provider === "stripe" ? subscriptionId : null]);
    }
  });
}

export async function cancelWorkspaceSubscription(workspaceId) {
  const subscription = await db.prepare(`
    SELECT plan_key AS "planKey", provider_subscription_id AS "providerSubscriptionId", status, expires_at AS "expiresAt"
    FROM workspace_subscriptions WHERE workspace_id = ?
  `).get(workspaceId);
  if (!subscription || subscription.planKey === "free" || subscription.status !== "active") {
    throw httpError(409, "There is no active paid subscription to cancel.");
  }
  if (subscription.providerSubscriptionId && config.stripeSecretKey) {
    try {
      const stripe = new Stripe(config.stripeSecretKey);
      const result = await stripe.subscriptions.update(subscription.providerSubscriptionId, { cancel_at_period_end: true });
      const periodEnd = result.current_period_end || result.items.data[0]?.current_period_end || null;
      await db.prepare(`
        UPDATE workspace_subscriptions SET cancel_at_period_end = TRUE, expires_at = to_timestamp(?), updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ?
      `).run(periodEnd, workspaceId);
      return { cancelAtPeriodEnd: true, expiresAt: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : subscription.expiresAt };
    } catch (error) {
      if (error.status) throw error;
      console.error("Subscription cancellation failed:", error);
      throw httpError(502, "Could not cancel the subscription with the payment provider. Please try again.");
    }
  }
  if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() > Date.now()) {
    await db.prepare(`
      UPDATE workspace_subscriptions SET cancel_at_period_end = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE workspace_id = ?
    `).run(workspaceId);
    return { cancelAtPeriodEnd: true, expiresAt: subscription.expiresAt };
  }
  await db.prepare(`
    UPDATE workspace_subscriptions SET status = 'cancelled', cancel_at_period_end = FALSE,
      expires_at = COALESCE(expires_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = ?
  `).run(workspaceId);
  return { cancelAtPeriodEnd: false, expiresAt: subscription.expiresAt };
}

export async function verifyStripeWebhook(req) {
  if (!config.stripeWebhookSecret) throw httpError(503, "Stripe webhook signing is not configured.");
  const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;
  if (!stripe) throw httpError(503, "Stripe is not configured.");
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get("stripe-signature"), config.stripeWebhookSecret);
  } catch {
    throw httpError(400, "Invalid Stripe webhook signature.");
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid" || session.mode === "subscription") {
      await completePayment("stripe", session.client_reference_id || session.metadata?.billingReference, session.subscription);
    }
  } else if (event.type === "customer.subscription.deleted") {
    await db.prepare(`
      UPDATE workspace_subscriptions SET status = 'cancelled', cancel_at_period_end = FALSE,
        expires_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE provider_subscription_id = ?
    `).run(event.data.object.id);
  } else if (event.type === "invoice.payment_failed") {
    await db.prepare(`
      UPDATE workspace_subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
      WHERE provider_subscription_id = ?
    `).run(event.data.object.subscription);
  } else if (event.type === "invoice.paid") {
    await db.prepare(`
      UPDATE workspace_subscriptions SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE provider_subscription_id = ?
    `).run(event.data.object.subscription);
  }
  return event.id;
}

export async function verifyPaystackWebhook(req) {
  const signature = req.get("x-paystack-signature");
  if (!isValidSignature(config.paystackWebhookSecret, signature, req.rawBody, "sha512")) {
    throw httpError(400, "Invalid Paystack webhook signature.");
  }
  const event = req.body;
  if (event?.event === "charge.success" && event.data?.status === "success") {
    const expectedAmount = await db.prepare(
      "SELECT amount_cents, currency FROM billing_records WHERE provider = 'paystack' AND provider_reference = ?",
    ).get(event.data.reference);
    if (expectedAmount
      && Number(expectedAmount.amount_cents) === Number(event.data.amount)
      && expectedAmount.currency.toUpperCase() === String(event.data.currency).toUpperCase()) {
      await completePayment("paystack", event.data.reference);
    }
  }
  return "ok";
}

export const availablePlans = Object.entries(plans).map(([key, plan]) => ({
  ...planDefinitions[key],
  usdMonthlyCents: plan.usd,
  ghsMonthlyCents: plan.ghs,
}));
