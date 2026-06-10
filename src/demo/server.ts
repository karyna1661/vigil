import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateOpsFeed, type FeedOverrides } from "../events/feed.js";
import { detectOperationalDrift, driftRules, driftDelta, type DriftState } from "../drift/detector.js";
import { decideActions } from "../policy/decideActions.js";
import type { ActionIntent } from "../policy/types.js";
import { mapActionsToExecutionPlans } from "../execution/mapper.js";
import type { ExecutionPlan } from "../execution/types.js";
import type { OpsEvent } from "../events/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const HTML_PATH = path.join(__dirname, "index.html");

type PipelineConfig = {
  feedOverrides?: FeedOverrides;
};

type AuditEntry = {
  step: string;
  statement: string;
};

const buildAuditTrail = (
  _events: OpsEvent[],
  drift: DriftState,
  actions: readonly ActionIntent[],
  plans: readonly ExecutionPlan[],
): AuditEntry[] => {
  const entries: AuditEntry[] = [];

  for (const event of drift.triggeredBy) {
    const rule = driftRules.find(
      (r) => r.eventKind === event.kind && r.metricName === event.metric.name,
    );
    if (!rule) continue;
    const delta = driftDelta(event, rule);
    const isCritical = delta >= rule.criticalDelta;
    entries.push({
      step: "rule-match",
      statement:
        `${rule.signal} \u2192 value ${event.metric.value}, ` +
        `threshold ${event.metric.threshold}, delta ${delta} ` +
        `${isCritical ? "\u2265" : "<"} criticalDelta ${rule.criticalDelta} ` +
        `\u2192 ${isCritical ? "CRITICAL" : "WARNING"} signal`,
    });
  }

  if (drift.level === "critical") {
    const warningSignals = drift.signals.filter(
      (s) => s !== "critical-escalation",
    );
    if (warningSignals.length >= 2) {
      entries.push({
        step: "escalation",
        statement:
          `${warningSignals.length} warning signals \u2192 ` +
          `critical-escalation rule \u2192 CRITICAL`,
      });
    }
  }

  for (const action of actions) {
    entries.push({
      step: "decision",
      statement:
        `${drift.level.toUpperCase()} \u2192 ${action.type} ` +
        `(${action.priority}, ${Math.round(action.confidence * 100)}% confidence)`,
    });
  }

  for (const plan of plans) {
    entries.push({
      step: "execution",
      statement:
        `${plan.target} / ${plan.action} \u2192 ` +
        `${plan.idempotencyKey.substring(0, 40)}...`,
    });
  }

  return entries;
};

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });

const runPipeline = async (config: PipelineConfig) => {
  const events = generateOpsFeed({
    matchId: "demo-match-001",
    startTime: Date.now(),
    overrides: config.feedOverrides,
  });
  const drift = detectOperationalDrift(events);
  const actions = decideActions(drift);
  const plans = mapActionsToExecutionPlans(actions);
  const audit = buildAuditTrail(events, drift, actions, plans);
  return { events, drift, actions, plans, audit };
};

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const html = fs.readFileSync(HTML_PATH, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } else if (req.method === "POST" && req.url === "/api/run") {
    try {
      const body = await readBody(req);
      const config: PipelineConfig = body ? JSON.parse(body) : {};
      const result = await runPipeline(config);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  } else if (req.method === "GET" && req.url === "/api/run") {
    try {
      const result = await runPipeline({});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log("MatchOps Commander running at http://localhost:" + PORT);
});
