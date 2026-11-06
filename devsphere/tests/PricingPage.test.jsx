import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../src/api/http.js", () => ({ get, post }));

import PricingPage from "../src/pages/PricingPage.jsx";

const plansResponse = {
  plans: [
    { key: "free", name: "Free", storageBytes: 5 * 1024 ** 3, maxProjects: 5, maxTasks: 100, maxMembers: 3, maxFiles: 250, maxFolders: 50, maxGroups: 3, dailyAiRequests: 10, usdMonthlyCents: 0, ghsMonthlyCents: 0 },
    { key: "pro", name: "Pro", storageBytes: 100 * 1024 ** 3, maxProjects: 100, maxTasks: 5000, maxMembers: 10, maxFiles: 10000, maxFolders: 1000, maxGroups: 25, dailyAiRequests: 500, usdMonthlyCents: 800, ghsMonthlyCents: 10000 },
    { key: "business", name: "Business", storageBytes: 1024 ** 4, maxProjects: 500, maxTasks: 25000, maxMembers: 50, maxFiles: 100000, maxFolders: 10000, maxGroups: 100, dailyAiRequests: 5000, usdMonthlyCents: 1600, ghsMonthlyCents: 20000 },
  ],
  current: { planKey: "pro", status: "active", currency: "usd" },
  usage: { storageBytes: 1024, storageLimitBytes: 100 * 1024 ** 3, files: 1, folders: 0 },
  providers: {
    usd: { name: "Stripe", configured: false, methods: ["Card"] },
    ghs: { name: "Paystack", configured: true, methods: ["Card", "Mobile money"] },
  },
};

describe("PricingPage", () => {
  beforeEach(() => {
    plansResponse.current.planKey = "pro";
    get.mockImplementation((path) => {
      if (path === "/billing/plans") return Promise.resolve(plansResponse);
      if (path === "/billing/history") return Promise.resolve({
        billing: [{
          id: 7,
          provider: "stripe",
          planKey: "pro",
          currency: "usd",
          amountCents: 800,
          status: "paid",
          createdAt: "2026-11-05T12:00:00.000Z",
        }],
      });
      return Promise.reject(new Error(`Unexpected API request: ${path}`));
    });
  });

  it("shows the active plan and billing history", async () => {
    render(createElement(PricingPage));

    expect(await screen.findByText(/Pro plan · active/i)).toBeInTheDocument();
    expect(screen.getByText("Billing activity")).toBeInTheDocument();
    expect(screen.getByText(/^stripe · /i)).toBeInTheDocument();
    expect(within(screen.getByText("Billing activity").closest("section")).getByText(/8\.00/)).toBeInTheDocument();
    expect(screen.getByText(/pro unlocks ai, whiteboards, huddles, and contract drafts/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /storage used/i })).toBeInTheDocument();
  });

  it("switches currency and only enables checkout for a configured provider", async () => {
    plansResponse.current.planKey = "free";
    render(createElement(PricingPage));
    await screen.findByText("Billing activity");

    const businessCard = screen.getByRole("heading", { name: "Business" }).closest("article");
    expect(within(businessCard).getByRole("button", { name: /stripe not configured/i })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: /pricing currency/i }), { target: { value: "GHS" } });

    expect(screen.getByText(/Pay securely with Paystack/i)).toBeInTheDocument();
    expect(within(businessCard).getByText(/200\.00/)).toBeInTheDocument();
    expect(within(businessCard).getByRole("button", { name: /continue with paystack/i })).toBeEnabled();
  });

  it("reports history request errors without hiding the plan cards", async () => {
    get.mockImplementation((path) => path === "/billing/plans"
      ? Promise.resolve(plansResponse)
      : Promise.reject(new Error("Billing history is unavailable.")));
    render(createElement(PricingPage));

    expect(await screen.findByRole("heading", { name: "Pro" })).toBeInTheDocument();
    expect(await screen.findByText("Billing history is unavailable.")).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith("/billing/history"));
  });
});
