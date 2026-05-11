import type { HealthReport, TraceStep, UiMessage } from "./types";

export async function fetchHealth(): Promise<HealthReport> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error(`Health request failed with ${response.status}`);
  return response.json() as Promise<HealthReport>;
}

export async function sendChat(messages: UiMessage[]): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = (await response.json()) as { answer?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Chat request failed with ${response.status}`);
  return data.answer ?? "";
}

export async function runAgent(question: string): Promise<{ answer: string; trace: TraceStep[] }> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  const data = (await response.json()) as { answer?: string; trace?: TraceStep[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Agent request failed with ${response.status}`);
  return { answer: data.answer ?? "", trace: data.trace ?? [] };
}
