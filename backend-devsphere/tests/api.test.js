import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "development";
process.env.DATABASE_URL = "postgres://test:test@localhost/devsphere";
process.env.DEVSPHERE_TEST_DATABASE = "pg-mem";
process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.PUBLIC_APP_URL = "http://localhost:5173";
process.env.STRIPE_SECRET_KEY = "";
process.env.PAYSTACK_SECRET_KEY = "";

const { closeDatabase, db, initializeDatabase } = await import("../src/db/database.js");
const { seedDatabase } = await import("../src/db/seed.js");
const { createApp } = await import("../src/app.js");
const app = createApp();
app.set("io", { to: () => ({ emit: () => {} }) });
let server;
let baseUrl;
let token;
let inviteToken;
let invitedUserId;
let onboardingUserId;
let workspaceId;
let projectId;
let limitProjectId;
let taskId;
let folderId;
let fileId;
let codeFileId;

async function json(route, { method = "GET", body, auth = token, form } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const payload = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

before(async () => {
  await initializeDatabase();
  await seedDatabase();
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  for (const id of [fileId, codeFileId]) {
    if (!id) continue;
    const storedFile = await db.prepare('SELECT storage_path AS "storagePath" FROM workspace_files WHERE id = ?').get(id);
    if (storedFile?.storagePath) {
      await unlink(storedFile.storagePath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    await db.prepare("DELETE FROM workspace_files WHERE id = ?").run(id);
  }
  if (folderId) await db.prepare("DELETE FROM workspace_files WHERE id = ?").run(folderId);
  if (taskId) await db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  if (projectId) await db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  if (limitProjectId) await db.prepare("DELETE FROM projects WHERE id = ?").run(limitProjectId);
  if (inviteToken) await db.prepare("DELETE FROM workspace_invitations WHERE token = ?").run(inviteToken);
  if (invitedUserId) await db.prepare("DELETE FROM users WHERE id = ?").run(invitedUserId);
  if (onboardingUserId) {
    const user = await db.prepare('SELECT workspace_id AS "workspaceId" FROM users WHERE id = ?').get(onboardingUserId);
    if (user) await db.prepare("DELETE FROM workspaces WHERE id = ?").run(user.workspaceId);
  }
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closeDatabase();
});

test("API supports account setup, collaboration, and workspace features", async () => {
  assert.equal((await json("/health")).status, "ok");
  token = (await json("/auth/login", {
    method: "POST",
    body: { email: "demo@devsphere.local", password: "devsphere123" },
    auth: null,
  })).token;
  assert.ok(token);
  const account = await json("/auth/me");
  assert.ok(account.workspace);
  workspaceId = account.user.workspaceId;
  const usage = await json("/workspace/usage");
  assert.equal(usage.plan.key, "free");
  assert.equal(usage.limits.storageBytes, 5 * 1024 ** 3);
  assert.equal(usage.limits.projects, 5);

  const invitation = await json("/workspace/invitations", {
    method: "POST",
    body: { email: "second@devsphere.local" },
  });
  inviteToken = new URL(invitation.inviteUrl).searchParams.get("invite");
  assert.equal((await json(`/auth/invitations/${inviteToken}`, { auth: null })).invitation.email, "second@devsphere.local");
  const invitedAccount = await json("/auth/register", {
    method: "POST",
    auth: null,
    body: { name: "Sam Student", email: "second@devsphere.local", password: "student-pass-123", inviteToken },
  });
  invitedUserId = (await json("/auth/me", { auth: invitedAccount.token })).user.id;
  assert.equal((await json("/workspace/preferences", { auth: invitedAccount.token })).preferences.onboardingCompleted, true);

  const studentCourse = await json("/student/courses", {
    method: "POST",
    body: { name: "Foundations of Biology", instructor: "Dr. Rivera", term: "Fall 2026" },
  });
  assert.equal(studentCourse.course.name, "Foundations of Biology");
  const studentAssignment = await json("/student/assignments", {
    method: "POST",
    body: {
      courseId: studentCourse.course.id,
      title: "Cell structure report",
      description: "Compare two cell types.",
      dueDate: "2026-11-20",
      pointsPossible: 100,
    },
  });
  assert.equal(studentAssignment.assignment.status, "To do");
  const invitedStudentData = await json("/student/dashboard", { auth: invitedAccount.token });
  assert.deepEqual(invitedStudentData.courses, []);
  assert.deepEqual(invitedStudentData.assignments, []);
  const submittedAssignment = await json(`/student/assignments/${studentAssignment.assignment.id}/submissions`, {
    method: "POST",
    body: { submissionText: "Cell comparison notes.", submissionUrl: "https://example.com/report" },
  });
  assert.equal(submittedAssignment.submission.status, "Submitted");
  const recordedGrade = await json(`/student/assignments/${studentAssignment.assignment.id}/grades`, {
    method: "POST",
    body: { score: 87.5, feedback: "Clear comparison." },
  });
  assert.equal(recordedGrade.grade.score, 87.5);
  assert.equal(recordedGrade.grade.status, "Graded");
  const studentDashboard = await json("/student/dashboard");
  assert.equal(studentDashboard.summary.averagePercent, 87.5);
  assert.equal(studentDashboard.assignments[0].submissionUrl, "https://example.com/report");
  const resubmitAfterGrade = await fetch(
    `${baseUrl}/student/assignments/${studentAssignment.assignment.id}/submissions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionText: "A changed submission." }),
    },
  );
  assert.equal(resubmitAfterGrade.status, 409);
  const crossAccountSubmission = await fetch(
    `${baseUrl}/student/assignments/${studentAssignment.assignment.id}/submissions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${invitedAccount.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionText: "Not my assignment." }),
    },
  );
  assert.equal(crossAccountSubmission.status, 404);
  const invalidGrade = await fetch(
    `${baseUrl}/student/assignments/${studentAssignment.assignment.id}/grades`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ score: 101 }),
    },
  );
  assert.equal(invalidGrade.status, 400);

  const newAccount = await json("/auth/register", {
    method: "POST",
    auth: null,
    body: { name: "New Member", email: "new-member@devsphere.local", password: "new-member-pass-123" },
  });
  onboardingUserId = (await json("/auth/me", { auth: newAccount.token })).user.id;
  assert.equal((await json("/workspace/preferences", { auth: newAccount.token })).preferences.onboardingCompleted, false);
  await json("/workspace/preferences", {
    method: "PUT",
    auth: newAccount.token,
    body: { workspaceName: "Northstar Studio", industry: "Student", role: "Student", teamSize: "2â€“5", workflow: "Study schedule" },
  });
  assert.equal((await json("/workspace/preferences", { auth: newAccount.token })).preferences.onboardingCompleted, true);

  const project = await json("/projects", {
    method: "POST",
    body: { name: "Integration Project", description: "Testing project detail" },
  });
  projectId = project.project.id;
  const lastFreeProject = await json("/projects", {
    method: "POST",
    body: { name: "Free tier limit project" },
  });
  limitProjectId = lastFreeProject.project.id;
  const deniedProject = await fetch(`${baseUrl}/projects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Project beyond free limit" }),
  });
  assert.equal(deniedProject.status, 403);
  const task = await json("/tasks", {
    method: "POST",
    body: { title: "Integration task", projectId, priority: "High" },
  });
  taskId = task.task.id;
  await json(`/tasks/${taskId}`, { method: "PATCH", body: { status: "In progress" } });
  const details = await json(`/projects/${projectId}`);
  assert.equal(details.project.taskCount, 1);
  assert.equal(details.tasks[0].status, "In progress");

  const notifications = await json("/notifications", { auth: invitedAccount.token });
  assert.ok(notifications.notifications.some((item) => item.title === "A new task was added"));
  const unread = notifications.notifications.find((item) => !item.readAt);
  await json(`/notifications/${unread.id}/read`, { method: "PATCH", body: {}, auth: invitedAccount.token });
  await json("/notifications/read-all", { method: "PATCH", body: {}, auth: invitedAccount.token });

  const channels = await json("/messages/channels");
  const message = await json("/messages", {
    method: "POST",
    body: { channelId: channels.channels[0].id, body: "Integration message" },
  });
  assert.equal(message.message.body, "Integration message");
  await json("/events", { method: "POST", body: { title: "Integration event", startsAt: "2027-01-01T10:00:00Z" } });
  assert.ok((await json("/events")).events.some((event) => event.title === "Integration event"));
  assert.ok((await json("/assistant", { method: "POST", body: { prompt: "What needs attention?" } })).answer);
  for (let request = 1; request < 10; request += 1) {
    await json("/assistant", { method: "POST", body: { prompt: "Summarize my workspace" } });
  }
  const deniedAiRequest = await fetch(`${baseUrl}/assistant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "One more question" }),
  });
  assert.equal(deniedAiRequest.status, 429);
  assert.ok((await json("/community")).posts.length > 0);
  assert.ok((await json("/blog")).posts.length > 0);
  const freeGroups = (await json("/groups")).groups;
  assert.equal(freeGroups.length, 0);
  const createdGroups = [];
  for (const name of ["Student group one", "Student group two", "Student group three"]) {
    const result = await json("/groups", { method: "POST", body: { name, topic: "Study" } });
    createdGroups.push(result.group);
    assert.equal(result.group.isMember, true);
  }
  const fourthGroup = await fetch(`${baseUrl}/groups`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Student group four" }),
  });
  assert.equal(fourthGroup.status, 403);
  await json(`/groups/${createdGroups[0].id}/membership`, { method: "DELETE" });
  await json(`/groups/${createdGroups[0].id}/join`, { method: "POST", body: {} });

  const extensions = (await json("/extensions")).extensions;
  assert.equal(extensions.length, 4);
  await json("/extensions/focus-timer/install", { method: "POST", body: {} });
  const deniedPaidExtension = await fetch(`${baseUrl}/extensions/ai-project-brief/install`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(deniedPaidExtension.status, 403);

  const deniedContract = await fetch(`${baseUrl}/contracts`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deniedContract.status, 403);
  await db.prepare(`
    INSERT INTO workspace_subscriptions (workspace_id, plan_key, status, currency)
    VALUES (?, 'pro', 'active', 'usd')
    ON CONFLICT(workspace_id) DO UPDATE SET plan_key = 'pro', status = 'active'
  `).run(workspaceId);
  await json("/extensions/ai-project-brief/install", { method: "POST", body: {} });
  const contract = await json("/contracts", {
    method: "POST",
    body: {
      title: "Freelance agreement",
      clientName: "Acme",
      contractType: "Freelance project",
      services: "Build a website",
      schedule: "Four weeks",
      fees: "USD 1,000",
    },
  });
  assert.match(contract.contract.content, /DRAFT FOR DISCUSSION/);
  const plans = await json("/billing/plans");
  assert.equal(plans.plans.length, 3);
  assert.equal(plans.plans[0].storageBytes, 5 * 1024 ** 3);
  assert.equal(plans.plans.find((plan) => plan.key === "pro").storageBytes, 100 * 1024 ** 3);
  assert.equal(plans.providers.usd.configured, false);
  assert.equal(plans.providers.ghs.configured, false);
  assert.deepEqual((await json("/billing/history")).billing, []);

  const deniedCrm = await fetch(`${baseUrl}/crm`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deniedCrm.status, 403);
  await db.prepare(`
    UPDATE workspace_subscriptions SET plan_key = 'business' WHERE workspace_id = ?
  `).run(workspaceId);
  await json("/extensions/client-pipeline/install", { method: "POST", body: {} });
  assert.equal((await json("/workspace/usage")).usage.groups, 3);
  const analytics = await json("/analytics");
  assert.ok(analytics.summary.projects >= 5);
  const contact = await json("/crm", {
    method: "POST",
    body: { name: "Test customer", company: "Example Co", email: "customer@example.com" },
  });
  assert.equal(contact.contact.stage, "Lead");
  await json(`/crm/${contact.contact.id}`, { method: "PATCH", body: { stage: "Qualified" } });
  await json(`/crm/${contact.contact.id}`, { method: "DELETE" });

  const invalidPlan = await fetch(`${baseUrl}/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ planKey: "unknown", currency: "USD" }),
  });
  assert.equal(invalidPlan.status, 400);
  const unconfiguredCheckout = await fetch(`${baseUrl}/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${newAccount.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ planKey: "pro", currency: "USD" }),
  });
  assert.equal(unconfiguredCheckout.status, 503);
  const duplicateSubscriptionCheckout = await fetch(`${baseUrl}/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ planKey: "business", currency: "USD" }),
  });
  assert.equal(duplicateSubscriptionCheckout.status, 409);

  const folder = await json("/files/folders", { method: "POST", body: { name: "Project materials" } });
  folderId = folder.file.id;
  const form = new FormData();
  form.append("file", new Blob(["Test document"], { type: "text/plain" }), "notes.txt");
  form.append("parentId", String(folderId));
  const uploaded = await json("/files/upload", { method: "POST", form });
  fileId = uploaded.file.id;
  const fileResponse = await fetch(`${baseUrl}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(fileResponse.status, 200);
  assert.equal(await fileResponse.text(), "Test document");

  const savedCode = await json("/files/code", {
    method: "POST",
    body: { name: "index.html", content: "<h1>Saved code</h1>", parentId: folderId },
  });
  codeFileId = savedCode.file.id;
  assert.equal(savedCode.file.parentId, folderId);
  assert.equal((await json(`/files/${codeFileId}/content`)).file.content, "<h1>Saved code</h1>");
  await json(`/files/${codeFileId}/content`, {
    method: "PUT",
    body: { name: "preview.html", content: "<h1>Updated preview</h1>" },
  });
  assert.equal((await json(`/files/${codeFileId}/content`)).file.name, "preview.html");
  assert.equal((await json(`/files/${codeFileId}/content`)).file.content, "<h1>Updated preview</h1>");
  const savedCodeResponse = await fetch(`${baseUrl}/files/${codeFileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(savedCodeResponse.status, 200);
  assert.equal(await savedCodeResponse.text(), "<h1>Updated preview</h1>");
  await assert.rejects(
    json("/files/code", { method: "POST", body: { name: "program.exe", content: "not supported" } }),
    /400/,
  );
});
