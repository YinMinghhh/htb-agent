import { getConfig } from "../config.js";
import type { SearchObservation } from "../types.js";

interface SearchOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  maxResults?: number;
}

interface TavilyResponse {
  query?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchObservation> {
  const apiKey = options.apiKey ?? getConfig().tavilyApiKey;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) throw new Error("TAVILY_API_KEY is required");

  const response = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: options.maxResults ?? 3,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Tavily request failed with ${response.status}: ${summarizeErrorBody(text, apiKey)}`
    );
  }

  const data = (await response.json()) as TavilyResponse;
  const results = (data.results ?? []).map((result) => ({
    title: result.title ?? "Untitled result",
    url: result.url ?? "",
    snippet: result.content ?? ""
  }));

  return {
    query: data.query ?? query,
    results,
    resultCount: results.length
  };
}

function summarizeErrorBody(text: string, apiKey: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "upstream error";

  const redacted = redactSecrets(trimmed, apiKey);
  if (isSafePlainError(redacted)) return redacted;

  return "upstream error";
}

function redactSecrets(text: string, apiKey: string): string {
  let redacted = text.replace(
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    "Bearer [redacted]"
  );
  if (apiKey) redacted = redacted.split(apiKey).join("[redacted]");
  return redacted;
}

function isSafePlainError(text: string): boolean {
  return /^invalid api key\.?$/i.test(text);
}
