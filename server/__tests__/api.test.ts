import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../index.js";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = undefined;
});

describe("API request validation", () => {
  it("rejects invalid chat requests without calling chat", async () => {
    const chat = vi.fn();
    const app = createApp({ chat });

    const response = await request(app, "/api/chat", { messages: [{ role: "user" }] });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid chat request" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("rejects empty chat message arrays without calling chat", async () => {
    const chat = vi.fn();
    const app = createApp({ chat });

    const response = await request(app, "/api/chat", { messages: [] });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid chat request" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("rejects invalid agent requests without calling runReactAgent", async () => {
    const runReactAgent = vi.fn();
    const app = createApp({ runReactAgent });

    const response = await request(app, "/api/agent", { question: "   " });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid agent request" });
    expect(runReactAgent).not.toHaveBeenCalled();
  });

  it("returns a generic error for unexpected chat failures", async () => {
    const chat = vi.fn().mockRejectedValue(new Error("secret token sk-live-private"));
    const app = createApp({ chat });

    const response = await request(app, "/api/chat", {
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected server error" });
  });

  it("returns a generic error for unexpected health check failures", async () => {
    const runHealthCheck = vi.fn().mockRejectedValue(new Error("secret health token"));
    const app = createApp({ runHealthCheck });

    const response = await withTimeout(
      request(app, "/api/health", undefined, { method: "GET" })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected server error" });
  });

  it("returns JSON for malformed JSON bodies", async () => {
    const chat = vi.fn();
    const app = createApp({ chat });

    const response = await request(app, "/api/chat", "{", { raw: true });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON request" });
    expect(chat).not.toHaveBeenCalled();
  });
});

async function request(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  options: { method?: "GET" | "POST"; raw?: boolean } = {}
) {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server?.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind test server");

  const method = options.method ?? "POST";
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : options.raw ? String(body) : JSON.stringify(body)
  });
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Request timed out")), 500);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
