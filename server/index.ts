import cors from "cors";
import express from "express";
import { getConfig } from "./config.js";
import { runReactAgent } from "./agent/reactAgent.js";
import { runHealthCheck } from "./health.js";
import { chat } from "./lib/llmClient.js";
import type { AgentRequest, ChatRequest } from "./types.js";

const app = express();
const config = getConfig();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  response.json(await runHealthCheck());
});

app.post("/api/chat", async (request, response) => {
  try {
    const body = request.body as ChatRequest;
    const answer = await chat(body.messages);
    response.json({ answer });
  } catch (error) {
    response.status(500).json({ error: formatError(error) });
  }
});

app.post("/api/agent", async (request, response) => {
  try {
    const body = request.body as AgentRequest;
    const result = await runReactAgent(body.question);
    response.json(result);
  } catch (error) {
    response.status(500).json({ error: formatError(error) });
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Agent demo API listening on http://127.0.0.1:${config.port}`);
});

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
