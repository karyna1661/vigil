import "dotenv/config";
import type { WorldState, Explanation, SeverityLevel } from "./types.js";

export type ExplanationInput = {
  event: string;
  country: string;
  hours_open: number;
  deployment_needed: boolean;
  alert_count_24h: number;
  severity_score: number;
  severity_level: SeverityLevel;
};

export type LLMAdapter = (prompt: string) => Promise<string>;

export function mapToExplanationInput(state: WorldState): ExplanationInput {
  return {
    event: state.event_name,
    country: state.country_name,
    hours_open: state.hours_open,
    deployment_needed: state.deployment_needed,
    alert_count_24h: state.alert_count_24h,
    severity_score: state.severity?.score ?? 0,
    severity_level: state.severity?.level ?? "LOW",
  };
}

const PROMPT_TEMPLATE = `You are an operational analysis assistant for humanitarian crisis response.

Your task:
Explain the severity of an alert using the provided JSON data.

RULES:
- Use the provided data to generate a meaningful explanation
- Be specific about the country, event type, and duration
- Explain why this situation matters operationally
- Suggest concrete next steps

INPUT:
{{input_json}}

OUTPUT FORMAT (valid JSON only):
{
  "summary": "One sentence summary of the situation",
  "cause": "Why this alert exists and what triggered it",
  "impact": "What happens if no action is taken",
  "recommended_action": "Specific next steps for response teams"
}`;

export function buildPrompt(input: ExplanationInput): string {
  return PROMPT_TEMPLATE.replace("{{input_json}}", JSON.stringify(input, null, 2));
}

export function validateExplanation(exp: unknown): exp is Explanation {
  if (typeof exp !== "object" || exp === null) return false;
  const obj = exp as Record<string, unknown>;
  return (
    typeof obj.summary === "string" &&
    typeof obj.cause === "string" &&
    typeof obj.impact === "string" &&
    typeof obj.recommended_action === "string" &&
    obj.summary.length > 0 && obj.summary.length < 300 &&
    obj.cause.length > 0 && obj.cause.length < 500 &&
    obj.impact.length > 0 && obj.impact.length < 500 &&
    obj.recommended_action.length > 0 && obj.recommended_action.length < 500
  );
}

function generateTemplateExplanation(input: ExplanationInput): Explanation {
  const daysOpen = Math.round(input.hours_open / 24);
  const urgency = input.severity_level === "CRITICAL" ? "immediate" :
                  input.severity_level === "HIGH" ? "urgent" :
                  input.severity_level === "MEDIUM" ? "timely" : "routine";

  const cause = input.deployment_needed
    ? `${input.country} has an open ${input.event} alert for ${daysOpen} days with no deployed response team.`
    : `${input.country} has an open ${input.event} alert for ${daysOpen} days.`;

  const impact = input.severity_level === "CRITICAL"
    ? `Critical severity (${input.severity_score.toFixed(2)}) indicates high risk to affected population requiring immediate action.`
    : input.severity_level === "HIGH"
    ? `High severity (${input.severity_score.toFixed(2)}) indicates significant operational gap needing ${urgency} attention.`
    : `Moderate severity (${input.severity_score.toFixed(2)}) indicates a developing situation requiring ${urgency} monitoring.`;

  return {
    summary: `${input.event} in ${input.country} — ${urgency} priority (${daysOpen} days open).`,
    cause,
    impact,
    recommended_action: input.severity_level === "CRITICAL"
      ? "Immediate deployment or response coordination required."
      : input.severity_level === "HIGH"
      ? "Urgent assessment and resource mobilization recommended."
      : "Continue monitoring and assess within 48 hours.",
  };
}

const SPLUNK_MCP_ENDPOINT = process.env.SPLUNK_MCP_ENDPOINT;
const SPLUNK_MCP_TOKEN = process.env.SPLUNK_MCP_TOKEN;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const endpoint = requireEnv("SPLUNK_MCP_ENDPOINT", SPLUNK_MCP_ENDPOINT);
  const token = requireEnv("SPLUNK_MCP_TOKEN", SPLUNK_MCP_TOKEN);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Splunk MCP error: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: { content?: { text?: string }[]; isError?: boolean };
  };

  if (data.result?.isError) {
    throw new Error(data.result?.content?.[0]?.text || "MCP tool error");
  }

  return data.result?.content?.[0]?.text || "";
}

export async function callSplunkAI(prompt: string): Promise<string> {
  const result = await callMCPTool("saia_ask_splunk_question", {
    prompt,
    spl_only: false,
  });
  return result;
}

const MIMO_BASE_URL = process.env.MIMO_BASE_URL;
const MIMO_MODEL = process.env.MIMO_MODEL;

export async function callMimo(prompt: string, apiKey: string): Promise<string> {
  const baseUrl = requireEnv("MIMO_BASE_URL", MIMO_BASE_URL);
  const model = requireEnv("MIMO_MODEL", MIMO_MODEL);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are an operational analysis assistant. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mimo API error: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No explanation generated");
  return content.trim();
}

export async function generateExplanation(
  input: ExplanationInput,
  llmAdapter?: LLMAdapter
): Promise<Explanation> {
  if (llmAdapter) {
    try {
      const prompt = buildPrompt(input);
      const result = await llmAdapter(prompt);
      const parsed = JSON.parse(result);
      if (validateExplanation(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn(
        `[EXPLAIN] LLM failed for ${input.country}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return generateTemplateExplanation(input);
}

const EXPLAIN_BATCH_SIZE = (() => {
  const raw = parseInt(process.env.EXPLAIN_BATCH_SIZE ?? "3", 10);
  return isNaN(raw) || raw < 1 ? 3 : raw;
})();

export async function explain(
  states: WorldState[],
  llmAdapter?: LLMAdapter
): Promise<WorldState[]> {
  const adapter = llmAdapter || createDefaultAdapter();
  const results: WorldState[] = [];

  for (let i = 0; i < states.length; i += EXPLAIN_BATCH_SIZE) {
    const batch = states.slice(i, i + EXPLAIN_BATCH_SIZE);
    const explained = await Promise.all(
      batch.map(async (s) => {
        const input = mapToExplanationInput(s);
        const explanation = await generateExplanation(input, adapter);
        return { ...s, explanation };
      })
    );
    results.push(...explained);
  }

  return results;
}

function createDefaultAdapter(): LLMAdapter | undefined {
  if (SPLUNK_MCP_TOKEN) {
    return async (prompt: string) => {
      try {
        return await callSplunkAI(prompt);
      } catch {
        const mimoKey = process.env.MIMO_API_KEY;
        if (mimoKey) {
          return callMimo(prompt, mimoKey);
        }
        throw new Error("Splunk AI unavailable and no MIMO_API_KEY");
      }
    };
  }

  const mimoKey = process.env.MIMO_API_KEY;
  if (mimoKey) {
    return (prompt: string) => callMimo(prompt, mimoKey);
  }

  return undefined;
}
