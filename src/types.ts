export type Language = "zh" | "en";
export type Mode = "chat" | "agent";

export interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TraceStep {
  id: string;
  label: "reason" | "action" | "observation" | "final" | "error";
  status: "running" | "succeeded" | "failed";
  title: string;
  detail: string;
  data?: unknown;
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
