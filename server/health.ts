import { getConfig, listMissingConfig, type AppConfig } from "./config.js";
import { chat as defaultChat } from "./lib/llmClient.js";
import { searchWeb as defaultSearchWeb } from "./tools/tavilySearch.js";
import type { HealthItem, HealthReport, SearchObservation } from "./types.js";

interface HealthOptions {
  config?: AppConfig;
  chat?: (messages: Parameters<typeof defaultChat>[0]) => Promise<string>;
  searchWeb?: (query: string) => Promise<SearchObservation>;
}

export async function runHealthCheck(options: HealthOptions = {}): Promise<HealthReport> {
  const config = options.config ?? getConfig();
  const chat = options.chat ?? defaultChat;
  const searchWeb = options.searchWeb ?? defaultSearchWeb;
  const items: HealthItem[] = [];

  const missing = listMissingConfig(config);
  for (const name of ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "TAVILY_API_KEY"]) {
    const ok = name === "OPENAI_BASE_URL" ? Boolean(config.openaiBaseUrl) : !missing.includes(name);
    items.push({
      name,
      ok,
      message: ok ? "configured" : "missing"
    });
  }

  if (missing.length > 0) {
    return { ok: false, items };
  }

  try {
    await chat([{ role: "user", content: "Reply with ok for a health check." }]);
    items.push({ name: "LLM probe", ok: true, message: "request succeeded" });
  } catch (error) {
    items.push({ name: "LLM probe", ok: false, message: formatError(error) });
  }

  try {
    await searchWeb("agent demo health check");
    items.push({ name: "Tavily probe", ok: true, message: "request succeeded" });
  } catch (error) {
    items.push({ name: "Tavily probe", ok: false, message: formatError(error) });
  }

  return {
    ok: items.every((item) => item.ok),
    items
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
