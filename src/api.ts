import type { HealthReport, TraceStep, UiMessage } from "./types";

type ErrorResponse = { error?: string; message?: string };

async function readJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await readJson<ErrorResponse>(response.clone());
  if (data?.error) return data.error;
  if (data?.message) return data.message;

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // Keep the status fallback when the body cannot be read.
  }

  return fallback;
}

export async function fetchHealth(): Promise<HealthReport> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Health request failed with ${response.status}`));
  }
  return response.json() as Promise<HealthReport>;
}

export async function sendChat(messages: UiMessage[]): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Chat request failed with ${response.status}`));
  }
  const data = await readJson<{ answer?: string }>(response);
  return data?.answer ?? "";
}

export async function runAgent(question: string): Promise<{ answer: string; trace: TraceStep[] }> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Agent request failed with ${response.status}`));
  }
  const data = await readJson<{ answer?: string; trace?: TraceStep[] }>(response);
  return { answer: data?.answer ?? "", trace: data?.trace ?? [] };
}
