import { runHealthCheck } from "../server/health.js";

const report = await runHealthCheck();

for (const item of report.items) {
  const mark = item.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${item.name}: ${item.message}`);
}

process.exitCode = report.ok ? 0 : 1;
