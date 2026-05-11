import type { Language } from "./types";

export const copy = {
  zh: {
    appTitle: "如何构建一个 Agent",
    chatMode: "纯 LLM 对话",
    agentMode: "ReAct Agent",
    inputPlaceholder: "输入一个问题...",
    send: "发送",
    run: "运行 Agent",
    traceTitle: "执行轨迹",
    healthReady: "服务可用",
    healthMissing: "缺少配置",
    healthFailed: "API 检查失败",
    corePath: "核心调用",
    emptyTrace: "运行 Agent 后会在这里看到推理摘要、动作和观察。",
    running: "处理中...",
    traceReason: "推理",
    traceAction: "动作",
    traceObservation: "观察",
    traceFinal: "最终结果",
    error: "错误"
  },
  en: {
    appTitle: "How to Build an Agent",
    chatMode: "Pure LLM Chat",
    agentMode: "ReAct Agent",
    inputPlaceholder: "Ask a question...",
    send: "Send",
    run: "Run Agent",
    traceTitle: "Execution Trace",
    healthReady: "Ready",
    healthMissing: "Missing config",
    healthFailed: "API check failed",
    corePath: "Core path",
    emptyTrace: "Run the agent to see reason summaries, actions, and observations.",
    running: "Working...",
    traceReason: "Reason",
    traceAction: "Action",
    traceObservation: "Observation",
    traceFinal: "Final",
    error: "Error"
  }
} as const;

export function t(language: Language): (typeof copy)[Language] {
  return copy[language];
}
