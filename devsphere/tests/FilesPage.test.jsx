import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, getToken, post, remove, uploadFile } = vi.hoisted(() => ({
  get: vi.fn(),
  getToken: vi.fn(),
  post: vi.fn(),
  remove: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("../src/api/http.js", () => ({ get, getToken, post, remove, uploadFile }));

import FilesPage from "../src/pages/FilesPage.jsx";

describe("FilesPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    get.mockResolvedValue({
      files: [
        { id: 2, parentId: null, name: "src", kind: "folder" },
        { id: 7, parentId: 2, name: "main.js", kind: "file", mimeType: "text/javascript", sizeBytes: 24 },
      ],
    });
  });

  it("navigates into folders and opens code files in Code Studio", async () => {
    const onNavigate = vi.fn();
    render(createElement(FilesPage, { onNavigate }));

    fireEvent.click(await screen.findByRole("button", { name: "src" }));
    fireEvent.click(await screen.findByRole("button", { name: /open main\.js in code studio/i }));

    expect(window.sessionStorage.getItem("devsphere-code-file-id")).toBe("7");
    expect(onNavigate).toHaveBeenCalledWith("Code studio");
  });
});
