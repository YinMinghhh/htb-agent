/**
 * llmClient.ts — 最短的 OpenAI-compatible Chat Completion 调用
 *
 * 这个文件代表"纯 LLM"：输入 messages，输出 assistant text。
 * 它不理解 Agent、不知道工具、没有循环。
 * reactAgent.ts 复用这个函数来获得模型的每一步推理结果。
 */

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

/**
 * 发送一组 messages 到 OpenAI-compatible API，返回 assistant 的文本回复。
 * 这就是所有 LLM 应用的最底层调用 — Agent 也是在这个基础上搭建的。
 */
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
  const summary = withoutApiKey.replace(/\bbearer\s+[^\s\r\n\t]+/gi, "[redacted]").trim().toLowerCase();
  const safeSummaries = new Set([
    "unauthorized",
    "forbidden",
    "not found",
    "too many requests",
    "rate limit exceeded",
    "bad request",
    "invalid request",
    "server error",
    "service unavailable"
  ]);
  return safeSummaries.has(summary) ? summary : "upstream response body omitted";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
