import { Router } from "express";
import { config } from "../config.js";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError } from "../middleware/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  availablePlans,
  cancelWorkspaceSubscription,
  completePayment,
  createCheckout,
  verifyPaystackWebhook,
  verifyStripeWebhook,
} from "../services/payments.js";
import { getWorkspacePlan, storageUsage } from "../services/planAccess.js";

const router = Router();

export const stripeWebhook = asyncHandler(async (req, res) => {
  const eventId = await verifyStripeWebhook(req);
  res.json({ received: true, eventId });
});

router.post("/webhooks/paystack", asyncHandler(async (req, res) => {
  await verifyPaystackWebhook(req);
  res.json({ received: true });
}));

router.use(authenticateToken);

router.get("/plans", async (req, res) => {
  const [current, usage, subscription] = await Promise.all([
    getWorkspacePlan(req.user.workspaceId),
    storageUsage(req.user.workspaceId),
    db.prepare(`
      SELECT cancel_at_period_end AS "cancelAtPeriodEnd", provider_reference AS "providerReference",
        currency, updated_at AS "updatedAt"
      FROM workspace_subscriptions WHERE workspace_id = ?
    `).get(req.user.workspaceId),
  ]);

  res.json({
    plans: availablePlans,
    current: {
      planKey: current.key,
      status: current.status,
      currency: subscription?.currency || "usd",
      expiresAt: current.expiresAt,
      cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
      updatedAt: subscription?.updatedAt || null,
    },
    usage: { ...usage, storageLimitBytes: current.storageBytes },
    providers: {
      usd: { name: "Stripe", configured: Boolean(config.stripeSecretKey), methods: ["Card"] },
      ghs: { name: "Paystack", configured: Boolean(config.paystackSecretKey), methods: ["Card", "Mobile money"] },
    },
  });
});

router.post("/subscription/cancel", async (req, res) => {
  const result = await cancelWorkspaceSubscription(req.user.workspaceId);
  res.json(result);
});

router.post("/checkout", asyncHandler(async (req, res) => {
  const planKey = String(req.body?.planKey || "");
  const currency = String(req.body?.currency || "USD").toUpperCase();
  const plan = availablePlans.find((item) => item.key === planKey);

  if (!plan) throw httpError(400, "Choose a valid plan.");

  const result = await createCheckout({ user: req.user, currency, planKey });
  res.status(201).json(result);
}));

router.get("/history", async (req, res) => {
  const billing = await db.prepare(`
    SELECT id, provider, plan_key AS "planKey", currency, amount_cents AS "amountCents",
      status, created_at AS "createdAt"
    FROM billing_records WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.workspaceId);

  res.json({ billing });
});

router.get("/status/:reference", async (req, res) => {
  const reference = String(req.params.reference).slice(0, 100);
  const billing = await db.prepare(`
    SELECT provider, plan_key AS "planKey", currency, amount_cents AS "amountCents", status
    FROM billing_records WHERE provider_reference = ? AND workspace_id = ?
  `).get(reference, req.user.workspaceId);

  if (!billing) throw httpError(404, "Payment was not found.");

  if (billing.provider === "paystack" && billing.status === "pending" && config.paystackSecretKey) {
    const verification = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        Accept: "application/json",
      },
    });

    if (verification.ok) {
      const result = await verification.json();
      if (
        result.status && result.data?.status === "success"
        && Number(result.data.amount) === Number(billing.amountCents)
        && String(result.data.currency).toLowerCase() === String(billing.currency).toLowerCase()
      ) {
        await completePayment("paystack", reference);
        billing.status = "paid";
      }
    }
  }

  res.json({ billing });
});

export default router;
