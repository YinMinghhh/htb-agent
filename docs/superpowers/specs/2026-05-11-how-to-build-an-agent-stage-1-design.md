# How to Build an Agent: Stage 1 展示代码设计

Status: accepted for implementation planning
Date: 2026-05-11
Workspace: `/Users/yinming/Workspace/htb-agent`

## 1. Purpose

本项目第一阶段用于一次关于 “how to build an agent” 的分享。目标不是做完整 agent 框架，而是用一套可运行、可展示、可讲解的代码说明：

- 纯生成式 LLM 是什么：用户输入、调用 API、返回文本。
- Agent 在此基础上多了什么：在同一个 LLM 调用核心外增加 reasoning 和 action。

第一阶段只实现四个 agent 能力中的两个：

- reasoning：让模型选择下一步，并生成可公开展示的短决策摘要。
- action：调用真实联网搜索工具获取外部信息。

perception 和 memory 明确留到后续阶段，不在第一阶段混入。

## 2. Product Shape

项目采用“同一个产品逐步长出 Agent”的叙事，而不是两套独立实验。

运行形态是 Web app + CLI smoke demo：

- Web app 是分享现场主舞台。
- CLI 入口用于证明核心逻辑不依赖 UI，并便于讲解最小调用链。

UI 默认中文，保留必要英文术语，例如 LLM、ReAct、Agent、Action。右上角提供 `中文 / EN` 一键切换。语言切换只影响前端文案，不改变 prompt、API 协议、trace JSON 或核心模块。

技术栈：

- Vite + React + TypeScript 前端。
- small Node server 提供 API。
- OpenAI-compatible chat API。
- Tavily 作为真实联网 search action。
- 手写最小 ReAct loop，不接 LangChain、LlamaIndex 或其他 agent 框架。

## 3. Architecture

核心代码分成三层：核心能力、服务端 API、展示 UI。

### Core modules

`server/lib/llmClient.ts`

最短、最直接的 OpenAI-compatible chat completion 调用文件。它只负责：

- 读取 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`。
- 发送 messages。
- 返回 assistant text。

它不理解 agent、不理解 Tavily、不理解 UI。

`server/tools/tavilySearch.ts`

真实联网 action。输入 query，输出结构化 observation：

- title
- url
- snippet/content
- raw result count

它不决定下一步，只提供工具结果。

`server/agent/reactAgent.ts`

手写最小 ReAct loop。它复用 `llmClient.ts`，在外层增加：

- step prompt
- step JSON 解析
- action dispatch
- observation accumulation
- step limit
- final answer 或错误返回

### Server API

`POST /api/chat`

纯 LLM 聊天，只调用 `llmClient.chat(messages)`。

`POST /api/agent`

运行 ReAct agent，返回 final answer 和 trace。第一版默认非 streaming；如果实现时间充足，可再增加事件流，但不作为第一阶段必要条件。

`GET /api/health` and `pnpm health`

启动前 health check，检查环境变量和最小真实请求是否可用。Web 和 CLI 复用同一个 checker。

### UI

统一应用壳，顶部切换两个模式：

- `纯 LLM 对话`
- `ReAct Agent`

LLM Chat 模式是单栏聊天界面。

ReAct Agent 模式是左侧聊天、右侧 trace 时间线。右侧显示公开可讲解的 agent trace，不展示隐藏 chain-of-thought。

## 4. Data Flow

### Pure LLM flow

```text
UI/CLI message
  -> /api/chat
  -> llmClient.chat(messages)
  -> assistant text
```

这个 demo 不引入工具、计划、记忆或外部环境。它的价值是保持“最小生成式 LLM”足够清楚。

### ReAct agent flow

```text
question
  -> reactAgent.run(question)
  -> llmClient.chat(step messages)
  -> parse step JSON
  -> call tavilySearch.searchWeb(query) when the step action is search_web
  -> append observation
  -> repeat until final answer or step limit
```

每一轮模型必须返回严格 JSON。

Action step:

```json
{
  "type": "action",
  "reason_summary": "Need fresh web information before answering.",
  "action": {
    "name": "search_web",
    "input": {
      "query": "..."
    }
  }
}
```

Final step:

```json
{
  "type": "final",
  "answer": "..."
}
```

`reason_summary` 是公开决策摘要，不是隐藏 chain-of-thought。分享时应明确说明：UI 展示的是 agent trace，而不是模型内部思维原文。

Trace step 至少包含：

- reason summary
- action name
- action input
- observation summary
- status: running, succeeded, failed

Agent 超过 step limit 后返回明确错误，例如：

```text
Agent stopped after 4 steps without final answer.
```

## 5. Search Action

第一阶段的 action 使用 Tavily 真实联网搜索。

Tool contract:

```ts
searchWeb(query: string): Promise<SearchObservation>
```

`SearchObservation` 应包含可展示结果，不直接暴露杂乱 API 响应：

- query
- results: title, url, snippet
- resultCount

UI 中 observation 展示标题、链接、摘要，便于观众确认 agent 确实调用了外部搜索。

## 6. Health Check

项目采用启动前 health check，不内置伪造结果 fallback。

Health check 覆盖：

- `OPENAI_API_KEY` 是否存在。
- `OPENAI_BASE_URL` 是否存在或是否能使用默认值。
- `OPENAI_MODEL` 是否存在。
- `TAVILY_API_KEY` 是否存在。
- LLM 最小请求是否成功。
- Tavily 最小搜索是否成功。

Web UI 右上角显示：

- `服务可用`
- `缺少配置`
- `API 检查失败`

点击或展开后展示具体失败项。运行时如果仍然失败，trace 在失败步骤显示错误，聊天区给出简短失败说明。

## 7. CLI

CLI 入口用于最小证明和现场备用演示。

Expected commands:

```bash
pnpm health
pnpm chat "用一句话解释什么是生成式 LLM"
pnpm agent "搜索一个需要最新信息的问题并总结"
```

`pnpm chat` 只经过 `llmClient.ts`。

`pnpm agent` 经过 `reactAgent.ts` 和 `tavilySearch.ts`，输出 trace + final answer。

## 8. UI Requirements

UI 是教学型工具，不做 landing page。打开就是可操作界面。

Default language:

- 中文优先。
- 必要术语保留英文。
- 提供 `中文 / EN` 分段按钮。

LLM Chat mode:

- 单栏聊天。
- 用户输入问题，助手返回回答。
- 可用轻量方式提示核心路径 `server/lib/llmClient.ts`，但不把界面写成说明文档。

ReAct Agent mode:

- 左侧聊天区。
- 右侧 trace 时间线。
- trace 标签默认中文：`推理摘要`、`动作`、`观察`、`最终回答`、`错误`。
- action 显示为 `search_web(query)` 或中文等价文案。
- observation 显示 Tavily 结果标题、链接、摘要。

Visual style:

- 安静、清爽、适合分享现场。
- 两个模式保持统一风格。
- 不使用营销式 hero。
- 不让视觉效果压过代码讲解。

## 9. Testing and Acceptance

Required verification:

```bash
pnpm lint
pnpm health
pnpm chat "用一句话解释什么是生成式 LLM"
pnpm agent "搜索一个需要最新信息的问题并总结"
```

Browser verification:

- 默认中文 UI。
- 一键切换英文 UI。
- `纯 LLM 对话` 模式可用。
- `ReAct Agent` 模式可用。
- Agent trace 显示 `推理摘要 -> 动作 -> 观察 -> 最终回答`。
- Health 状态可见，失败时能指出缺失配置或 API 错误。

Acceptance criteria:

- 纯 LLM 核心调用文件短小直接，适合在分享中打开讲。
- ReAct agent 明显复用同一个 LLM 核心。
- action 是真实 Tavily 联网搜索。
- UI 能清楚呈现 agent 比纯 LLM 多出的 reasoning/action loop。
- CLI 能独立跑通最小 chat 和 agent demo。
- 不展示隐藏 chain-of-thought。

## 10. Non-goals

第一阶段不做：

- 长期 memory。
- 视觉 perception。
- 通用 browser automation。
- LangChain / LlamaIndex 接入。
- 多工具 registry 的复杂框架。
- 多模型评测或 benchmark。
- 把 search 结果伪造成模型内置知识。
- 失败时伪造 live 结果。
