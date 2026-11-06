import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../src/pages/LandingPage.jsx";

describe("LandingPage", () => {
  it("renders the supplied landing content and product audiences", () => {
    const { container } = render(createElement(LandingPage, { onGetStarted: vi.fn(), onSignIn: vi.fn() }));

    expect(container.querySelector("#hero-headline")?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/everything you need to build, learn, and work together/i);
    expect(container.querySelector(".strip__logos")?.textContent).toContain("Students");
    expect(container.querySelector(".features__grid")?.textContent).toContain("Project management");
    expect(container.querySelector(".features__grid")?.textContent).toContain("AI productivity");
    expect(container.querySelector(".features__grid")?.textContent).toContain("Learning hub");
    expect(container.querySelector("#pricing-heading")?.textContent).toMatch(/start free\. scale as you grow/i);
    expect(container.querySelector(".nav__logo")?.getAttribute("src")).toBe("/prototype/assets/logo/devsphere-logo.svg");
    expect(container.querySelector(".final-cta__illustration")?.getAttribute("src")).toBe("/prototype/assets/logo/devsphere-symbol-dark.svg");
  });

  it("wires prototype sign-in and create-workspace links to React auth", () => {
    const onGetStarted = vi.fn();
    const onSignIn = vi.fn();
    const { container } = render(createElement(LandingPage, { onGetStarted, onSignIn }));

    fireEvent.click(container.querySelector('a[href="pages/signup.html"]'));
    fireEvent.click(container.querySelector('a[href="pages/login.html"]'));

    expect(onGetStarted).toHaveBeenCalledOnce();
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("keeps section links and the resource/footer app routes connected", () => {
    const onNavigate = vi.fn();
    const { container } = render(createElement(LandingPage, { onGetStarted: vi.fn(), onSignIn: vi.fn(), onNavigate }));
    const navigation = container.querySelector('nav[aria-label="Primary"]');

    expect(navigation.querySelector('a[href="#product"]')).toBeInTheDocument();
    expect(navigation.querySelector('a[href="#solutions"]')).toBeInTheDocument();
    expect(navigation.querySelector('a[href="#pricing"]')).toBeInTheDocument();
    expect(container.querySelector("#pricing")).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-app-view="Community"]'));
    expect(onNavigate).toHaveBeenCalledWith("Community");
  });
});
