import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../src/api/http.js", () => api);

import StudentDashboardPage from "../src/pages/StudentDashboardPage.jsx";

describe("StudentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      courses: [{ id: 1, name: "Biology", instructor: "Dr. Rivera", term: "Fall 2026" }],
      assignments: [{
        id: 4,
        courseId: 1,
        courseName: "Biology",
        title: "Cell structure report",
        dueDate: "2026-11-20",
        pointsPossible: 100,
        score: 87.5,
        status: "Graded",
        submittedAt: "2026-11-18T10:00:00Z",
        gradedAt: "2026-11-19T10:00:00Z",
      }],
      summary: { courseCount: 1, assignmentCount: 1, toDoCount: 0, submittedCount: 0, gradedCount: 1, averagePercent: 87.5 },
    });
  });

  it("shows student courses, graded assignments, and grade tracking", async () => {
    render(createElement(StudentDashboardPage));

    expect(await screen.findByRole("heading", { name: "Student dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText("Biology")).toHaveLength(2);
    expect(screen.getByText("Cell structure report")).toBeInTheDocument();
    expect(screen.getByText("87.5%")).toBeInTheDocument();
    expect(screen.getByText("87.5 / 100")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/student/dashboard"));
  });
});
