import { randomUUID } from "node:crypto";
import { chat as defaultChat } from "../lib/llmClient.js";
import { searchWeb as defaultSearchWeb } from "../tools/tavilySearch.js";
import type { AgentRunResult, ChatMessage, SearchObservation, TraceStep } from "../types.js";

type ChatFn = (messages: ChatMessage[]) => Promise<string>;
type SearchFn = (query: string) => Promise<SearchObservation>;

interface RunOptions {
  chat?: ChatFn;
  searchWeb?: SearchFn;
  maxSteps?: number;
}

type AgentStep =
  | {
      type: "action";
      reason_summary: string;
      action: {
        name: "search_web";
        input: { query: string };
      };
    }
  | {
      type: "final";
      answer: string;
    };

const SYSTEM_PROMPT = `You are a small ReAct-style demo agent.
Return only strict JSON.
When you need fresh information, return:
{"type":"action","reason_summary":"short public decision summary","action":{"name":"search_web","input":{"query":"search query"}}}
When you can answer, return:
{"type":"final","answer":"final answer in the user's language"}
Do not reveal hidden chain-of-thought. The reason_summary must be a short public explanation of why the next action is useful.`;

export async function runReactAgent(
  question: string,
  options: RunOptions = {}
): Promise<AgentRunResult> {
  const chat = options.chat ?? defaultChat;
  const searchWeb = options.searchWeb ?? defaultSearchWeb;
  const maxSteps = options.maxSteps ?? 4;
  const trace: TraceStep[] = [];
  const observations: SearchObservation[] = [];

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    let raw: string;
    try {
      raw = await chat(buildMessages(question, observations));
    } catch {
      trace.push(
        makeTraceStep(
          "error",
          "failed",
          "模型调用失败",
          "Agent could not get a valid model response."
        )
      );
      return { answer: "", trace };
    }

    let step: AgentStep;
    try {
      step = parseAgentStep(raw);
    } catch {
      trace.push(
        makeTraceStep(
          "error",
          "failed",
          "模型输出无效",
          "Agent could not parse a valid action or final answer."
        )
      );
      return { answer: "", trace };
    }

    if (step.type === "final") {
      trace.push(makeTraceStep("final", "succeeded", "最终回答", step.answer));
      return { answer: step.answer, trace };
    }

    const query = step.action.input.query;
    trace.push(makeTraceStep("reason", "succeeded", "推理摘要", step.reason_summary));
    trace.push(
      makeTraceStep("action", "running", "搜索网页", `search_web(${JSON.stringify(query)})`, {
        query
      })
    );

    try {
      const observation = await searchWeb(query);
      observations.push(observation);
      trace[trace.length - 1] = {
        ...trace[trace.length - 1],
        status: "succeeded"
      };
      trace.push(
        makeTraceStep(
          "observation",
          "succeeded",
          "观察",
          formatObservation(observation),
          observation
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trace[trace.length - 1] = {
        ...trace[trace.length - 1],
        status: "failed"
      };
      trace.push(makeTraceStep("error", "failed", "工具调用失败", message));
      return { answer: "", trace };
    }
  }

  trace.push(
    makeTraceStep(
      "error",
      "failed",
      "Step limit reached",
      `Agent stopped after ${maxSteps} steps without final answer.`
    )
  );
  return { answer: "", trace };
}

function buildMessages(question: string, observations: SearchObservation[]): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Question: ${question}`,
        "",
        "Previous observations:",
        observations.length === 0 ? "None" : observations.map(formatObservation).join("\n\n")
      ].join("\n")
    }
  ];
}

function parseAgentStep(raw: string): AgentStep {
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as unknown;

  if (!isRecord(parsed)) throw new Error("Invalid agent step");
  if (parsed.type === "final" && typeof parsed.answer === "string") {
    return { type: "final", answer: parsed.answer };
  }
  if (
    parsed.type === "action" &&
    typeof parsed.reason_summary === "string" &&
    isRecord(parsed.action) &&
    parsed.action.name === "search_web" &&
    isRecord(parsed.action.input) &&
    typeof parsed.action.input.query === "string"
  ) {
    return {
      type: "action",
      reason_summary: parsed.reason_summary,
      action: {
        name: "search_web",
        input: { query: parsed.action.input.query }
      }
    };
  }

  throw new Error("Invalid agent step");
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function formatObservation(observation: SearchObservation): string {
  if (observation.results.length === 0) return `No results for "${observation.query}".`;
  return observation.results
    .map((result, index) => `${index + 1}. ${result.title}\n${result.url}\n${result.snippet}`)
    .join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function makeTraceStep(
  label: TraceStep["label"],
  status: TraceStep["status"],
  title: string,
  detail: string,
  data?: unknown
): TraceStep {
  return {
    id: randomUUID(),
    label,
    status,
    title,
    detail,
    data
  };
}
