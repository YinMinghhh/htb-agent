import { getConfig, type AppConfig } from "../config.js";
import type { ChatMessage } from "../types.js";

interface ChatOptions {
  config?: AppConfig;
  fetchImpl?: typeof fetch;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const config = options.config ?? getConfig();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required");
  if (!config.openaiModel) throw new Error("OPENAI_MODEL is required");

  const response = await fetchImpl(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature: options.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const text = summarizeErrorText(await response.text(), config.openaiApiKey);
    throw new Error(`LLM request failed with ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== "string") throw new Error("LLM response did not include assistant content");
  return answer;
}

function summarizeErrorText(text: string, apiKey: string): string {
  const withoutApiKey = apiKey ? text.replace(new RegExp(escapeRegExp(apiKey), "gi"), "[redacted]") : text;
  const redacted = withoutApiKey.replace(
    /\bbearer\s+(?!bearer\b)[A-Za-z0-9._-]+/gi,
    "[redacted]"
  );
  const summary = redacted.trim();
  const unsafe = /^\s*[\[{]|[{}"]|\b(message|messages|prompt|content|request|authorization|bearer|api key)\b/i;
  if (!summary || summary.length > 120 || unsafe.test(summary)) return "upstream response body omitted";
  return summary;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
