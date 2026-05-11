import type { HealthReport, TraceStep, UiMessage } from "./types";

type ErrorResponse = { error?: string; message?: string };

async function readJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

export async function fetchHealth(): Promise<HealthReport> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    const data = await readJson<ErrorResponse>(response);
    throw new Error(data?.error ?? data?.message ?? `Health request failed with ${response.status}`);
  }
  return response.json() as Promise<HealthReport>;
}

export async function sendChat(messages: UiMessage[]): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = await readJson<{ answer?: string; error?: string }>(response);
  if (!response.ok) throw new Error(data?.error ?? `Chat request failed with ${response.status}`);
  return data?.answer ?? "";
}

export async function runAgent(question: string): Promise<{ answer: string; trace: TraceStep[] }> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  const data = await readJson<{ answer?: string; trace?: TraceStep[]; error?: string }>(response);
  if (!response.ok) throw new Error(data?.error ?? `Agent request failed with ${response.status}`);
  return { answer: data?.answer ?? "", trace: data?.trace ?? [] };
}
