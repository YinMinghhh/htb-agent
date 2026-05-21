# How to Build an Agent

> 用一套可运行、可讲解的代码，展示现代 Agent 的核心原理。

本仓库是一个教学项目，围绕两个关键知识点：

1. **Agent 的四大功能模块** — Perception、Reasoning、Action、Memory，其中 Reasoning 和 Action 是 Agent 最本质的特征
2. **如何构建一个 ReAct Loop** — 手写最小循环，不依赖任何 Agent 框架

项目同时提供 Web UI 和 CLI，方便现场演示和独立探索。

---

## 架构概览

```
┌────────────────────────────────────────────────────────┐
│                   ReAct Agent Loop                      │
│                                                        │
│   ┌──────────┐     ┌──────────┐     ┌──────────────┐  │
│   │ Reasoning│────▶│  Action  │────▶│ Observation  │  │
│   │ (LLM)   │     │ (Tool)   │     │ (Result)     │  │
│   └──────────┘     └──────────┘     └──────────────┘  │
│        ▲                                    │          │
│        └────────────────────────────────────┘          │
│                  loop until final answer                │
└────────────────────────────────────────────────────────┘
```

核心代码只有三个文件：

| 文件 | 职责 | 知识点 |
|------|------|--------|
| `server/lib/llmClient.ts` | 最短的 OpenAI-compatible chat 调用 | 纯 LLM 是什么 |
| `server/agent/reactAgent.ts` | 手写 ReAct 循环 | Reasoning + Action 交替 |
| `server/tools/tavilySearch.ts` | 真实联网搜索工具 | Tool / Action 的具体实现 |

---

## 快速开始

### 前置条件

- Node.js >= 20
- pnpm
- OpenAI-compatible API key（OpenAI / DeepSeek / 其他兼容服务）
- [Tavily](https://tavily.com/) API key（免费注册即可）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/yinming/htb-agent.git
cd htb-agent

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API keys

# 4. 检查配置是否正确
pnpm health

# 5. 启动开发服务器（Web UI + API）
pnpm dev
```

打开 http://127.0.0.1:5173 即可看到界面。

### CLI 演示

不需要 UI 也能跑通核心逻辑：

```bash
# 纯 LLM 对话（只经过 llmClient.ts）
pnpm chat "用一句话解释什么是生成式 LLM"

# ReAct Agent（经过 reactAgent.ts + tavilySearch.ts）
pnpm agent "2026 年最流行的 JavaScript 运行时有哪些？"
```

---

## 项目结构

```
.
├── server/                  # 后端：API + 核心逻辑
│   ├── lib/llmClient.ts     # ⭐ 最小 LLM 调用（学习起点）
│   ├── agent/reactAgent.ts  # ⭐ ReAct 循环（核心知识点）
│   ├── tools/tavilySearch.ts# ⭐ 搜索工具（Action 实现）
│   ├── index.ts             # Express API 入口
│   ├── config.ts            # 环境变量管理
│   ├── health.ts            # 启动前健康检查
│   ├── errors.ts            # 错误格式化
│   ├── types.ts             # 共享类型定义
│   └── __tests__/           # 单元测试
├── src/                     # 前端：React UI
│   ├── App.tsx              # 主界面（双模式切换）
│   ├── api.ts               # 前端 API 调用层
│   ├── i18n.ts              # 中英文文案
│   └── types.ts             # 前端类型
├── scripts/                 # CLI 入口
│   ├── agent.ts             # pnpm agent
│   ├── chat.ts              # pnpm chat
│   └── health.ts            # pnpm health
└── presentations/           # 配套演讲稿（HTML slides）
```

---

## 学习路径

建议按以下顺序阅读代码：

### Step 1: 理解纯 LLM 调用

打开 `server/lib/llmClient.ts`（~50 行）。这是最简单的 OpenAI chat completion 调用：发送 messages，返回 assistant text。没有 agent，没有工具，没有循环。

### Step 2: 理解 ReAct 循环

打开 `server/agent/reactAgent.ts`（~160 行）。它复用了 Step 1 的 LLM 调用，在外层加了：
- **System Prompt** — 告诉模型返回 JSON，描述可用工具
- **For 循环** — 每一轮调用 LLM，解析返回的 JSON
- **Action 分发** — 如果模型选择了 `search_web`，就调用 Tavily
- **Observation 积累** — 把工具结果追加到下一轮的上下文中
- **终止条件** — 模型返回 `type: "final"` 或达到步数限制

这就是 ReAct 的全部：**Reasoning（LLM 选择下一步）+ Action（执行工具）交替进行，直到得出答案。**

### Step 3: 理解 Tool 实现

打开 `server/tools/tavilySearch.ts`（~60 行）。一个工具就是一个函数：输入参数，调用外部 API，返回结构化结果。工具本身不做决策，只负责执行。

---

## ReAct 数据流

```
用户提问
  → reactAgent.run(question)
    → llmClient.chat(messages)        # Reasoning: 模型判断下一步
    → 解析 JSON 响应
    → tavilySearch.searchWeb(query)    # Action: 调用工具
    → 将结果追加到 messages           # Observation: 工具返回
    → 回到 llmClient.chat(...)        # 循环下一轮
    → ...
    → 模型返回 { type: "final" }      # 结束
  → 返回 answer + trace
```

模型每一步必须返回严格 JSON：

```jsonc
// Action step — 需要更多信息
{
  "type": "action",
  "reason_summary": "需要搜索最新信息来回答",
  "action": { "name": "search_web", "input": { "query": "..." } }
}

// Final step — 可以回答了
{
  "type": "final",
  "answer": "最终答案..."
}
```

---

## Agent 四大模块对照

| 模块 | 本项目实现 | 说明 |
|------|-----------|------|
| **Reasoning** | `reactAgent.ts` 中的 LLM 调用 + JSON 解析 | 模型决定"下一步做什么" |
| **Action** | `tavilySearch.ts` 联网搜索 | 执行外部操作 |
| Perception | System Prompt + 用户输入 | 第一阶段简化实现 |
| Memory | 循环内的 observations 数组 | 第一阶段仅为短期记忆 |

> Reasoning 和 Action 是 Agent 的本质特征。没有 Reasoning，模型不会自主决策；没有 Action，模型无法影响外部世界。两者的交替循环就是 Agent。

---

## 技术栈

- **前端**: Vite + React + TypeScript
- **后端**: Express + Node.js
- **LLM**: OpenAI-compatible Chat Completions（支持 OpenAI、DeepSeek 等）
- **工具**: Tavily Search API
- **测试**: Vitest
- **特点**: 手写 ReAct 循环，不依赖 LangChain / LlamaIndex 等框架

---

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（API + Web UI） |
| `pnpm build` | 类型检查 + 前端构建 |
| `pnpm test` | 运行测试 |
| `pnpm lint` | TypeScript 类型检查 |
| `pnpm health` | 检查 API keys 和连通性 |
| `pnpm chat "问题"` | CLI 纯 LLM 对话 |
| `pnpm agent "问题"` | CLI ReAct Agent |

---

## 后续扩展方向

本项目第一阶段只实现了 Reasoning + Action。如果你想继续实验：

- **Perception** — 加入文件读取、图片理解等输入能力
- **Memory** — 加入向量数据库做长期记忆
- **多工具** — 注册更多工具（计算器、代码执行、数据库查询）
- **Streaming** — 改为 SSE 流式输出 trace
- **Function Calling** — 对比手写 JSON 解析 vs OpenAI Function Calling 方案

---

## 配套演讲稿

`presentations/how-to-build-an-agent/` 目录包含配套的 HTML slides，直接用浏览器打开 `index.html` 即可：

```bash
open presentations/how-to-build-an-agent/index.html
```

---

## License

[MIT](./LICENSE)
