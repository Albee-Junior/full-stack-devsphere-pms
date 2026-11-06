import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "../src/components/layout/Sidebar.jsx";

describe("Sidebar", () => {
  it("keeps the footer compact and lets people reveal account and support links", () => {
    const { container } = render(createElement(Sidebar, {
      activeView: "Overview",
      onNavigate: vi.fn(),
      workspace: { name: "Northstar Studio" },
      user: { name: "Alex Morgan" },
      plan: { name: "Free", features: [] },
      onLogout: vi.fn(),
      open: false,
      onClose: vi.fn(),
    }));

    const toggle = screen.getByRole("button", { name: "Show account & support" });
    expect(container.querySelector(".sidebar-footer-details")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help & support" })).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse account & support" }));
    expect(container.querySelector(".sidebar-footer-details")).not.toBeInTheDocument();
  });
});
