# How to Build an Agent

> 用一套可运行、可讲解的代码，展示现代 Agent 的核心原理。

本仓库围绕两个关键知识点：

1. **Agent 的四大功能模块** — Perception、Reasoning、Action、Memory，其中 Reasoning 和 Action 是 Agent 最本质的特征
2. **如何构建一个 ReAct Loop** — 手写最小循环，不依赖任何 Agent 框架

---

## 从演讲稿开始

**建议首先打开配套的演讲稿**，它用图文和代码片段逐步讲清了 Agent 的核心原理：

```bash
open presentations/how-to-build-an-agent/index.html
```

使用左右方向键翻页。内容包括：

- 什么是 Agent — 四大功能模块的拆解
- 四个能力如何落在"上下文工程"里
- ReAct 论文的历史意义
- ReAct 循环的运行方式
- 核心代码实现要点
- Live Demo 真实交互

<!-- TODO: 演讲稿截图 -->

---

## 核心知识点

### Agent 四大模块

| 模块 | 职责 | 本项目实现 |
|------|------|-----------|
| **Reasoning** | 判断下一步做什么 | `reactAgent.ts` 中 LLM 调用 + JSON 解析 |
| **Action** | 执行外部操作 | `tavilySearch.ts` 联网搜索 |
| Perception | 接收和整理输入 | System Prompt + 用户输入（简化实现） |
| Memory | 保存上下文 | 循环内的 observations 数组（短期记忆） |

> Reasoning 和 Action 是 Agent 的本质特征。没有 Reasoning，模型不会自主决策；没有 Action，模型无法影响外部世界。两者的交替循环就是 Agent。

### ReAct 循环

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

整个循环的数据流：

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

---

## 阅读代码

核心实现只有三个文件，建议按以下顺序阅读：

| 顺序 | 文件 | 行数 | 看什么 |
|------|------|------|--------|
| 1 | `server/lib/llmClient.ts` | ~50 | 纯 LLM 调用：发 messages，收 text |
| 2 | `server/agent/reactAgent.ts` | ~160 | ReAct 循环：Reasoning → Action → Observation |
| 3 | `server/tools/tavilySearch.ts` | ~60 | 工具实现：输入参数，调 API，返回结果 |

每个文件顶部都有中文注释解释设计意图。

---

## 后续扩展方向

本项目只实现了 Reasoning + Action。如果想继续实验：

- **Perception** — 加入文件读取、图片理解等输入能力
- **Memory** — 加入向量数据库做长期记忆
- **多工具** — 注册更多工具（计算器、代码执行、数据库查询）
- **Streaming** — 改为 SSE 流式输出 trace
- **Function Calling** — 对比手写 JSON 解析 vs OpenAI Function Calling 方案

---

## 运行项目

想在本地跑起来？参考 **[运行指南](./docs/setup.md)**，包含安装步骤、环境配置和可用脚本说明。

---

## License

[MIT](./LICENSE)
