export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  answer: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchObservation {
  query: string;
  results: SearchResult[];
  resultCount: number;
}

export type TraceStatus = "running" | "succeeded" | "failed";

export interface TraceStep {
  id: string;
  label: "reason" | "action" | "observation" | "final" | "error";
  status: TraceStatus;
  title: string;
  detail: string;
  data?: unknown;
}

export interface AgentRunResult {
  answer: string;
  trace: TraceStep[];
}

export interface AgentRequest {
  question: string;
}

export interface HealthItem {
  name: string;
  ok: boolean;
  message: string;
}

export interface HealthReport {
  ok: boolean;
  items: HealthItem[];
}
