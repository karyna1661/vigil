import "dotenv/config";
import { runIngestion } from "./ingest.js";

async function main() {
  try {
    const { events, metrics } = await runIngestion();
    console.log("\n[RESULT]");
    console.log(`  Events ingested: ${metrics.sent}`);
    console.log(`  Failed: ${metrics.failed}`);
    console.log(`  Duration: ${metrics.cycle_duration_ms}ms`);
    console.log(`  Batch size: ${metrics.batch_size}`);

    if (events.length > 0) {
      console.log("\n[SAMPLE]");
      const sample = events.slice(0, 3);
      for (const e of sample) {
        console.log(`  ${e.country} | ${e.disaster_type} | ${e.status} | ${e.created_at}`);
      }
    }
  } catch (error) {
    console.error("[ERROR]", error);
    process.exit(1);
  }
}

main();
