import { formatPublicError } from "../server/errors.js";
import { runHealthCheck } from "../server/health.js";

try {
  const report = await runHealthCheck();

  for (const item of report.items) {
    const mark = item.ok ? "PASS" : "FAIL";
    console.log(`${mark} ${item.name}: ${item.message}`);
  }

  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(`Health check failed: ${formatPublicError(error)}`);
  process.exitCode = 1;
}
