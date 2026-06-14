import "dotenv/config";

const endpoint = process.env.SPLUNK_MCP_ENDPOINT;
const token = process.env.SPLUNK_MCP_TOKEN;

if (!endpoint || !token) {
  console.error("Missing SPLUNK_MCP_ENDPOINT or SPLUNK_MCP_TOKEN in .env");
  process.exit(1);
}

async function callMCP(method: string, params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(endpoint as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
  });
  return response.json();
}

console.log("=== VIGIL MCP TEST ===\n");

// 1. List tools
console.log("1. Listing MCP tools...");
const toolsResult = await callMCP("tools/list", {}) as { result?: { tools?: Array<{ name: string }> } };
const tools = toolsResult.result?.tools?.map((t) => t.name) ?? [];
console.log("   Tools found:", tools.length);
tools.forEach((t) => console.log("   -", t));

// 2. Check indexes
console.log("\n2. Checking Splunk indexes...");
const indexesResult = await callMCP("tools/call", {
  name: "splunk_get_indexes",
  arguments: { row_limit: 50 },
}) as { result?: { content?: { text?: string }[] } };
const indexesText = indexesResult.result?.content?.[0]?.text ?? "";
const hasVigil = indexesText.includes("vigil");
console.log("   Vigil index exists:", hasVigil ? "YES" : "NO — CREATE IT IN SPLUNK WEB");

// 3. Run sample query
console.log("\n3. Running sample SPL query...");
const queryResult = await callMCP("tools/call", {
  name: "splunk_run_query",
  arguments: {
    query: '| metadata index=* type=sourcetypes | head 20',
    earliest_time: "-24h",
    latest_time: "now",
    row_limit: 20,
  },
}) as { result?: { content?: { text?: string }[] } };
const queryText = queryResult.result?.content?.[0]?.text ?? "";
console.log("   Result:", queryText.substring(0, 1000));

console.log("\n=== TEST COMPLETE ===");
