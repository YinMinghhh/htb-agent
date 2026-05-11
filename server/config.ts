import "dotenv/config";

export interface AppConfig {
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  tavilyApiKey: string;
  port: number;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    openaiBaseUrl: trimTrailingSlash(normalizeEnvValue(env.OPENAI_BASE_URL) || "https://api.openai.com/v1"),
    openaiApiKey: normalizeEnvValue(env.OPENAI_API_KEY),
    openaiModel: normalizeEnvValue(env.OPENAI_MODEL),
    tavilyApiKey: normalizeEnvValue(env.TAVILY_API_KEY),
    port: Number(env.PORT || "8787")
  };
}

export function listMissingConfig(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.openaiBaseUrl) missing.push("OPENAI_BASE_URL");
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.openaiModel) missing.push("OPENAI_MODEL");
  if (!config.tavilyApiKey) missing.push("TAVILY_API_KEY");
  return missing;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim() || "";
}
