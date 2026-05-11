import { pathToFileURL } from "node:url";
import cors from "cors";
import express, { type Express } from "express";
import { getConfig } from "./config.js";
import { runReactAgent as defaultRunReactAgent } from "./agent/reactAgent.js";
import { formatPublicError } from "./errors.js";
import { runHealthCheck as defaultRunHealthCheck } from "./health.js";
import { chat as defaultChat } from "./lib/llmClient.js";
import type { ChatMessage } from "./types.js";

interface AppDependencies {
  chat?: typeof defaultChat;
  runReactAgent?: typeof defaultRunReactAgent;
  runHealthCheck?: typeof defaultRunHealthCheck;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const chat = dependencies.chat ?? defaultChat;
  const runReactAgent = dependencies.runReactAgent ?? defaultRunReactAgent;
  const runHealthCheck = dependencies.runHealthCheck ?? defaultRunHealthCheck;

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    try {
      response.json(await runHealthCheck());
    } catch (error) {
      response.status(500).json({ error: formatPublicError(error) });
    }
  });

  app.post("/api/chat", async (request, response) => {
    try {
      if (!isChatRequest(request.body)) {
        response.status(400).json({ error: "Invalid chat request" });
        return;
      }

      const answer = await chat(request.body.messages);
      response.json({ answer });
    } catch (error) {
      response.status(500).json({ error: formatPublicError(error) });
    }
  });

  app.post("/api/agent", async (request, response) => {
    try {
      if (!isAgentRequest(request.body)) {
        response.status(400).json({ error: "Invalid agent request" });
        return;
      }

      const result = await runReactAgent(request.body.question);
      response.json(result);
    } catch (error) {
      response.status(500).json({ error: formatPublicError(error) });
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction
    ) => {
      if (isJsonParseError(error)) {
        response.status(400).json({ error: "Invalid JSON request" });
        return;
      }
      next(error);
    }
  );

  return app;
}

function isChatRequest(body: unknown): body is { messages: ChatMessage[] } {
  return (
    isRecord(body) &&
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    body.messages.every(
      (message) =>
        isRecord(message) &&
        isChatRole(message.role) &&
        typeof message.content === "string"
    )
  );
}

function isAgentRequest(body: unknown): body is { question: string } {
  return isRecord(body) && typeof body.question === "string" && body.question.trim().length > 0;
}

function isChatRole(value: unknown): value is ChatMessage["role"] {
  return value === "system" || value === "user" || value === "assistant";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    isRecord(error) &&
    error.status === 400 &&
    "body" in error
  );
}

if (isDirectExecution()) {
  const config = getConfig();
  createApp().listen(config.port, "127.0.0.1", () => {
    console.log(`Agent demo API listening on http://127.0.0.1:${config.port}`);
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}
