import { chat } from "../server/lib/llmClient.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: pnpm chat "你的问题"');
  process.exit(1);
}

const answer = await chat([{ role: "user", content: question }]);
console.log(answer);
