import { db } from "../db/database.js";
import { httpError } from "../middleware/errors.js";

const gibibyte = 1024 ** 3;
const currentUsageDate = () => new Date().toISOString().slice(0, 10);

export const planDefinitions = {
  free: {
    key: "free",
    name: "Free",
    storageBytes: 5 * gibibyte,
    maxProjects: 5,
    maxTasks: 100,
    maxMembers: 3,
    maxFiles: 250,
    maxFolders: 50,
    maxGroups: 3,
    dailyAiRequests: 10,
    features: [],
  },
  pro: {
    key: "pro",
    name: "Pro",
    storageBytes: 100 * gibibyte,
    maxProjects: 100,
    maxTasks: 5000,
    maxMembers: 10,
    maxFiles: 10000,
    maxFolders: 1000,
    maxGroups: 25,
    dailyAiRequests: 500,
    features: ["ai", "whiteboard", "contracts", "huddle"],
  },
  business: {
    key: "business",
    name: "Business",
    storageBytes: 1024 * gibibyte,
    maxProjects: 500,
    maxTasks: 25000,
    maxMembers: 50,
    maxFiles: 100000,
    maxFolders: 10000,
    maxGroups: 100,
    dailyAiRequests: 5000,
    features: ["ai", "whiteboard", "contracts", "huddle", "analytics", "crm"],
  },
};

export async function getWorkspacePlan(workspaceId) {
  const subscription = await db.prepare(`
    SELECT plan_key AS "planKey", status, expires_at AS "expiresAt"
    FROM workspace_subscriptions
    WHERE workspace_id = ?
  `).get(workspaceId);

  const isActive = subscription?.status === "active"
    && (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > Date.now());
  const plan = isActive ? planDefinitions[subscription.planKey] : null;
  return {
    ...planDefinitions.free,
    ...(plan || {}),
    status: isActive ? subscription.status : "active",
    expiresAt: isActive ? subscription.expiresAt : null,
  };
}

export function requireFeature(feature) {
  return async (req, _res, next) => {
    try {
      const plan = await getWorkspacePlan(req.user.workspaceId);
      if (!plan.features.includes(feature)) {
        const requiredPlan = feature === "analytics" || feature === "crm" ? "Business" : "Pro";
        throw httpError(403, `${feature} is available on ${requiredPlan}. Upgrade your workspace to continue.`);
      }
      req.workspacePlan = plan;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function enforceCountLimit(workspaceId, table, column, limit, label) {
  const allowedTables = new Set(["community_groups", "projects", "tasks", "users", "workspace_files"]);
  const allowedColumns = new Set(["workspace_id", "kind"]);
  if (!allowedTables.has(table) || !allowedColumns.has(column)) {
    throw new Error("Unsupported plan limit query.");
  }
  const where = column === "kind" ? "workspace_id = ? AND kind = ?" : "workspace_id = ?";
  const params = column === "kind" ? [workspaceId, label === "folder" ? "folder" : "file"] : [workspaceId];
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get(...params);
  if (Number(row.count) >= limit) {
    const humanLabel = label === "folder" ? "folder" : label;
    throw httpError(403, `Your plan allows up to ${limit} ${humanLabel}${limit === 1 ? "" : "s"}. Upgrade your workspace for a higher limit.`);
  }
}

export async function storageUsage(workspaceId) {
  const usage = await db.prepare(`
    SELECT COALESCE(SUM(size_bytes), 0) AS "storageBytes",
      COUNT(*) FILTER (WHERE kind = 'file') AS files,
      COUNT(*) FILTER (WHERE kind = 'folder') AS folders
    FROM workspace_files WHERE workspace_id = ?
  `).get(workspaceId);
  return {
    storageBytes: Number(usage.storageBytes),
    files: Number(usage.files),
    folders: Number(usage.folders),
  };
}

export async function workspaceUsage(workspaceId) {
  const [plan, files, counts, aiUsage] = await Promise.all([
    getWorkspacePlan(workspaceId),
    storageUsage(workspaceId),
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM projects WHERE workspace_id = ?) AS projects,
        (SELECT COUNT(*) FROM tasks WHERE workspace_id = ?) AS tasks,
        (SELECT COUNT(*) FROM users WHERE workspace_id = ?) AS members,
        (SELECT COUNT(*) FROM community_groups WHERE workspace_id = ?) AS groups
    `).get(workspaceId, workspaceId, workspaceId, workspaceId),
    db.prepare(`
      SELECT request_count AS count FROM workspace_feature_usage
      WHERE workspace_id = ? AND feature_key = 'ai' AND usage_date = ?::DATE
    `).get(workspaceId, currentUsageDate()),
  ]);
  return {
    plan: {
      key: plan.key,
      name: plan.name,
      status: plan.status,
      expiresAt: plan.expiresAt,
      features: plan.features,
    },
    usage: {
      ...files,
      projects: Number(counts.projects),
      tasks: Number(counts.tasks),
      members: Number(counts.members),
      groups: Number(counts.groups),
      aiRequestsToday: Number(aiUsage?.count || 0),
    },
    limits: {
      storageBytes: plan.storageBytes,
      projects: plan.maxProjects,
      tasks: plan.maxTasks,
      members: plan.maxMembers,
      files: plan.maxFiles,
      folders: plan.maxFolders,
      groups: plan.maxGroups,
      dailyAiRequests: plan.dailyAiRequests,
    },
  };
}

export async function consumeDailyAllowance(workspaceId, feature, limit) {
  await db.prepare(`
    INSERT INTO workspace_feature_usage (workspace_id, feature_key, usage_date, request_count)
    VALUES (?, ?, ?::DATE, 0)
    ON CONFLICT(workspace_id, feature_key, usage_date) DO NOTHING
  `).run(workspaceId, feature, currentUsageDate());
  const result = await db.prepare(`
    UPDATE workspace_feature_usage SET request_count = request_count + 1
    WHERE workspace_id = ? AND feature_key = ? AND usage_date = ?::DATE AND request_count < ?
  `).run(workspaceId, feature, currentUsageDate(), limit);
  if (!result.changes) {
    throw httpError(429, `You've reached today's ${feature} limit of ${limit}. Upgrade your plan for a higher limit.`);
  }
}

export async function ensureStorageAvailable(workspaceId, additionalBytes, excludingFileId = null) {
  const plan = await getWorkspacePlan(workspaceId);
  const current = await db.prepare(`
    SELECT COALESCE(SUM(size_bytes), 0) AS "storageBytes"
    FROM workspace_files
    WHERE workspace_id = ? AND (?::BIGINT IS NULL OR id <> ?)
  `).get(workspaceId, excludingFileId, excludingFileId);
  const usedBytes = Number(current.storageBytes);
  if (usedBytes + additionalBytes > plan.storageBytes) {
    const remaining = Math.max(0, plan.storageBytes - usedBytes);
    throw httpError(413, `This upload exceeds your ${plan.name} storage limit. ${remaining} bytes remain; upgrade your workspace for more storage.`);
  }
}
