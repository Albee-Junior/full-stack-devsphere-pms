import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("../src/api/http.js", () => ({ get, post, put }));

import CodeStudioPage from "../src/pages/CodeStudioPage.jsx";

describe("CodeStudioPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    get.mockResolvedValue({ value: null });
    post.mockResolvedValue({ file: { id: 21, name: "index.html" } });
    put.mockResolvedValue({ file: { id: 21, name: "index.html" } });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:devsphere-preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("saves the document into Files and renders an isolated preview link", async () => {
    render(createElement(CodeStudioPage));
    await screen.findByRole("textbox", { name: "Code editor" });

    fireEvent.click(screen.getByRole("button", { name: /save to files/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/files/code", expect.objectContaining({ name: "index.html" })));
    expect(await screen.findByRole("status")).toHaveTextContent(/saved to files & folders/i);

    fireEvent.click(screen.getByRole("button", { name: /run preview/i }));
    expect(await screen.findByTitle("HTML code preview")).toHaveAttribute("sandbox", "allow-scripts");
    expect(screen.getByRole("link", { name: /open preview link/i })).toHaveAttribute("href", "blob:devsphere-preview");
  });

  it("opens a selected file from the workspace Files page", async () => {
    window.sessionStorage.setItem("devsphere-code-file-id", "42");
    get.mockImplementation((path) => path === "/files/42/content"
      ? Promise.resolve({ file: { id: 42, name: "main.js", content: "console.log('opened');" } })
      : Promise.resolve({ value: null }));

    render(createElement(CodeStudioPage));

    expect(await screen.findByRole("textbox", { name: "File name" })).toHaveValue("main.js");
    expect(screen.getByRole("textbox", { name: "Code editor" })).toHaveValue("console.log('opened');");
    expect(get).toHaveBeenCalledWith("/files/42/content");
    expect(window.sessionStorage.getItem("devsphere-code-file-id")).toBeNull();
  });
});
