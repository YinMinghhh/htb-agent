import { runReactAgent } from "../server/agent/reactAgent.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: pnpm agent "你的问题"');
  process.exit(1);
}

const result = await runReactAgent(question);

for (const step of result.trace) {
  console.log(`\n[${step.status}] ${step.title}`);
  console.log(step.detail);
}

if (result.answer) {
  console.log(`\nFinal answer:\n${result.answer}`);
}

process.exitCode = result.answer ? 0 : 1;
