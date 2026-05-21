/**
 * reactAgent.ts — 手写最小 ReAct (Reasoning + Acting) 循环
 *
 * 这是本项目的核心知识点。它展示了如何把一个"只会生成文本"的 LLM
 * 变成一个"能自主决策并调用工具"的 Agent：
 *
 * 1. 用 System Prompt 告诉模型返回结构化 JSON
 * 2. 在 for 循环中反复调用 LLM，解析它的决策
 * 3. 如果模型选择了一个 Action，就执行对应的工具
 * 4. 把工具返回的 Observation 追加到下一轮上下文
 * 5. 循环直到模型返回 "final" 或达到步数限制
 *
 * 这就是 ReAct 的全部。没有 LangChain，没有框架，只有一个循环。
 */

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

/**
 * System Prompt — 告诉模型它是一个 ReAct agent，必须返回严格 JSON。
 * 这是让普通 LLM "变成" agent 的关键：通过 prompt 定义行为模式。
 */
const SYSTEM_PROMPT = `You are a small ReAct-style demo agent.
Return only strict JSON.
When you need fresh information, return:
{"type":"action","reason_summary":"short public decision summary","action":{"name":"search_web","input":{"query":"search query"}}}
When you can answer, return:
{"type":"final","answer":"final answer in the user's language"}
Do not reveal hidden chain-of-thought. The reason_summary must be a short public explanation of why the next action is useful.`;

/**
 * 运行 ReAct Agent：输入一个问题，返回最终答案和完整执行轨迹。
 *
 * 核心循环：
 *   Reasoning (LLM 判断) → Action (工具调用) → Observation (结果)
 *   重复，直到 LLM 认为可以给出最终答案。
 */
export async function runReactAgent(
  question: string,
  options: RunOptions = {}
): Promise<AgentRunResult> {
  const chat = options.chat ?? defaultChat;
  const searchWeb = options.searchWeb ?? defaultSearchWeb;
  const maxSteps = options.maxSteps ?? 4;
  const trace: TraceStep[] = [];
  const observations: SearchObservation[] = [];

  // ─── ReAct Loop: 每次迭代 = 一轮 Thought → Action → Observation ───
  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    // ─── Reasoning: 调用 LLM，让模型决定下一步 ───
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

    // ─── 解析模型的 JSON 决策 ───
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

    // ─── 终止条件：模型认为可以给出最终答案 ───
    if (step.type === "final") {
      trace.push(makeTraceStep("final", "succeeded", "最终回答", step.answer));
      return { answer: step.answer, trace };
    }

    // ─── Action: 执行模型选择的工具 ───
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
