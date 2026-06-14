import "dotenv/config";

const base = process.env.SPLUNK_BASE_URL!.replace(":8089", "");
const username = process.env.SPLUNK_USERNAME!;
const password = process.env.SPLUNK_PASSWORD!;
const auth = Buffer.from(`${username}:${password}`).toString("base64");

const spl = `index=* sourcetype=ifrc:surge_alert | stats count by country, disaster_type | head 5`;

const body = new URLSearchParams({
  search: spl,
  output_mode: "json",
});

// Try multiple endpoints
const endpoints = [
  `${base}/services/search/jobs/export`,
  `${base}/services/search/jobs`,
  `${base}/api/services/search/jobs/export`,
];

async function tryEndpoints() {
  for (const url of endpoints) {
    console.log(`\nTrying: ${url}`);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      console.log(`  Status: ${r.status}`);
      if (r.status !== 404) {
        const text = await r.text();
        console.log(`  Body: ${text.substring(0, 300)}`);
        return;
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

tryEndpoints();
