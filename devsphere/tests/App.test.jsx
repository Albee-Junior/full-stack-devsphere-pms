import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/hooks/useAuth.js", () => ({
  useAuth: () => ({
    user: null,
    workspace: null,
    loading: false,
    logout: vi.fn(),
    saveWorkspacePreferences: vi.fn(),
  }),
}));

import App from "../src/App.jsx";

describe("public app entry", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows the landing page first and lets a visitor enter and leave authentication", () => {
    const { container } = render(createElement(App));

    expect(container.querySelector("#hero-headline")?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/everything you need to build, learn, and work together/i);
    fireEvent.click(container.querySelector('a[href="pages/signup.html"]'));
    expect(container.querySelector(".auth-main h2")?.textContent).toMatch(/create your workspace/i);

    fireEvent.click(container.querySelector(".auth-brand"));
    expect(container.querySelector("#hero-headline")?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/everything you need to build, learn, and work together/i);
  }, 15000);
});
