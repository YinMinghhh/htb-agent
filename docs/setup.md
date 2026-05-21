# 运行指南

## 前置条件

- Node.js >= 20
- pnpm
- OpenAI-compatible API key（OpenAI / DeepSeek / 其他兼容服务）
- [Tavily](https://tavily.com/) API key（免费注册即可）

## 安装与运行

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

## CLI 演示

不需要 UI 也能跑通核心逻辑：

```bash
# 纯 LLM 对话（只经过 llmClient.ts）
pnpm chat "用一句话解释什么是生成式 LLM"

# ReAct Agent（经过 reactAgent.ts + tavilySearch.ts）
pnpm agent "2026 年最流行的 JavaScript 运行时有哪些？"
```

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

## 技术栈

- **前端**: Vite + React + TypeScript
- **后端**: Express + Node.js
- **LLM**: OpenAI-compatible Chat Completions（支持 OpenAI、DeepSeek 等）
- **工具**: Tavily Search API
- **测试**: Vitest
- **特点**: 手写 ReAct 循环，不依赖 LangChain / LlamaIndex 等框架
