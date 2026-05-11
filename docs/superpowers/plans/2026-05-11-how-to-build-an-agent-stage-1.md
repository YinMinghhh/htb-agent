# How to Build an Agent Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Chinese-first demo that shows a pure LLM chat growing into a minimal ReAct agent with reasoning summaries and Tavily web search actions.

**Architecture:** Use one short OpenAI-compatible LLM client as the shared root. Add a Tavily search tool and a hand-written ReAct loop on the server, then expose both pure chat and agent runs through a small Express API, CLI commands, and a Vite React UI with bilingual labels.

**Tech Stack:** Vite, React, TypeScript, Express, Vitest, tsx, OpenAI-compatible chat completions over `fetch`, Tavily Search API over `fetch`.

---

## File Structure

Create this structure:

```text
.
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── server/
│   ├── agent/reactAgent.ts
│   ├── config.ts
│   ├── health.ts
│   ├── index.ts
│   ├── lib/llmClient.ts
│   ├── tools/tavilySearch.ts
│   ├── types.ts
│   └── __tests__/
│       ├── health.test.ts
│       ├── llmClient.test.ts
│       ├── reactAgent.test.ts
│       └── tavilySearch.test.ts
├── scripts/
│   ├── agent.ts
│   ├── chat.ts
│   └── health.ts
└── src/
    ├── App.tsx
    ├── api.ts
    ├── i18n.ts
    ├── main.tsx
    ├── styles.css
    ├── types.ts
    └── __tests__/
        └── i18n.test.ts
```

Responsibilities:

- `server/lib/llmClient.ts`: the shortest readable OpenAI-compatible chat call.
- `server/tools/tavilySearch.ts`: Tavily `POST /search` wrapper using `Authorization: Bearer <TAVILY_API_KEY>`.
- `server/agent/reactAgent.ts`: minimal ReAct loop, strict JSON parsing, tool dispatch, trace creation.
- `server/health.ts`: shared health checker for CLI and Web API.
- `server/index.ts`: Express API for `/api/chat`, `/api/agent`, `/api/health`.
- `scripts/*.ts`: CLI smoke demos.
- `src/*`: Chinese-first UI, English toggle, mode switch, chat view, agent trace view.

## Implementation Tasks

### Task 1: Project Scaffold and Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.app.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create package metadata and scripts**

Write `package.json`:

```json
{
  "name": "htb-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"pnpm dev:server\" \"pnpm dev:web\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:web": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.app.json --noEmit && vite build",
    "lint": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.app.json --noEmit",
    "test": "vitest run",
    "health": "tsx scripts/health.ts",
    "chat": "tsx scripts/chat.ts",
    "agent": "tsx scripts/agent.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.19.2",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "concurrently": "^9.1.0",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run with the local proxy because this command touches the network:

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
pnpm install
```

Expected: `node_modules/` and `pnpm-lock.yaml` are created.

- [ ] **Step 3: Create TypeScript configs**

Write `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
```

Write `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"],
    "noEmit": true
  },
  "include": ["server", "scripts", "vite.config.ts"]
}
```

Write `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create Vite config**

Write `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 5: Create HTML entry and env example**

Write `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>如何构建一个 Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `.env.example`:

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=
TAVILY_API_KEY=
PORT=8787
```

Modify `.gitignore` so it contains exactly these lines:

```gitignore
.superpowers/
node_modules/
dist/
.env
.env.local
coverage/
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
pnpm exec tsc -p tsconfig.node.json --noEmit
```

Expected: TypeScript checks the Node-side config and exits successfully.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsconfig.node.json tsconfig.app.json vite.config.ts index.html .env.example .gitignore
git commit -m "chore: scaffold agent demo project"
```

### Task 2: Shared Types and Configuration

**Files:**
- Create: `server/types.ts`
- Create: `server/config.ts`
- Create: `server/__tests__/health.test.ts`

- [ ] **Step 1: Create shared server types**

Write `server/types.ts`:

```ts
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
```

- [ ] **Step 2: Create configuration loader**

Write `server/config.ts`:

```ts
import "dotenv/config";

export interface AppConfig {
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  tavilyApiKey: string;
  port: number;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    openaiBaseUrl: trimTrailingSlash(env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiModel: env.OPENAI_MODEL || "",
    tavilyApiKey: env.TAVILY_API_KEY || "",
    port: Number(env.PORT || "8787")
  };
}

export function listMissingConfig(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.openaiBaseUrl) missing.push("OPENAI_BASE_URL");
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.openaiModel) missing.push("OPENAI_MODEL");
  if (!config.tavilyApiKey) missing.push("TAVILY_API_KEY");
  return missing;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
```

- [ ] **Step 3: Write config tests**

Write `server/__tests__/health.test.ts` with the first config tests:

```ts
import { describe, expect, it } from "vitest";
import { getConfig, listMissingConfig } from "../config.js";

describe("config", () => {
  it("uses the OpenAI base URL default", () => {
    const config = getConfig({
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-test",
      TAVILY_API_KEY: "tvly-test"
    });

    expect(config.openaiBaseUrl).toBe("https://api.openai.com/v1");
  });

  it("lists missing required config keys", () => {
    const config = getConfig({});

    expect(listMissingConfig(config)).toEqual([
      "OPENAI_API_KEY",
      "OPENAI_MODEL",
      "TAVILY_API_KEY"
    ]);
  });
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test server/__tests__/health.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit shared config**

```bash
git add server/types.ts server/config.ts server/__tests__/health.test.ts
git commit -m "feat: add shared config and server types"
```

### Task 3: Pure LLM Client

**Files:**
- Create: `server/lib/llmClient.ts`
- Create: `server/__tests__/llmClient.test.ts`

- [ ] **Step 1: Write failing LLM client tests**

Write `server/__tests__/llmClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { chat } from "../lib/llmClient.js";

describe("llmClient.chat", () => {
  it("calls an OpenAI-compatible chat completions endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "你好，这是回答。" } }]
      })
    });

    const answer = await chat(
      [{ role: "user", content: "你好" }],
      {
        config: {
          openaiBaseUrl: "https://example.test/v1",
          openaiApiKey: "sk-test",
          openaiModel: "demo-model",
          tavilyApiKey: "tvly-test",
          port: 8787
        },
        fetchImpl: fetchMock
      }
    );

    expect(answer).toBe("你好，这是回答。");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("throws a useful error when the API rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized"
    });

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "bad-key",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.toThrow("LLM request failed with 401: unauthorized");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test server/__tests__/llmClient.test.ts
```

Expected: fail because `server/lib/llmClient.ts` does not exist.

- [ ] **Step 3: Implement short LLM client**

Write `server/lib/llmClient.ts`:

```ts
import { getConfig, type AppConfig } from "../config.js";
import type { ChatMessage } from "../types.js";

interface ChatOptions {
  config?: AppConfig;
  fetchImpl?: typeof fetch;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const config = options.config ?? getConfig();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required");
  if (!config.openaiModel) throw new Error("OPENAI_MODEL is required");

  const response = await fetchImpl(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature: options.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed with ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error("LLM response did not include assistant content");
  return answer;
}
```

- [ ] **Step 4: Run LLM client tests**

Run:

```bash
pnpm test server/__tests__/llmClient.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Commit LLM client**

```bash
git add server/lib/llmClient.ts server/__tests__/llmClient.test.ts
git commit -m "feat: add openai compatible llm client"
```

### Task 4: Tavily Search Tool

**Files:**
- Create: `server/tools/tavilySearch.ts`
- Create: `server/__tests__/tavilySearch.test.ts`

- [ ] **Step 1: Write failing Tavily tests**

Write `server/__tests__/tavilySearch.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { searchWeb } from "../tools/tavilySearch.js";

describe("searchWeb", () => {
  it("normalizes Tavily search results for display", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "agent demo",
        results: [
          {
            title: "Result One",
            url: "https://example.com/one",
            content: "A useful search snippet."
          }
        ]
      })
    });

    const observation = await searchWeb("agent demo", {
      apiKey: "tvly-test",
      fetchImpl: fetchMock
    });

    expect(observation).toEqual({
      query: "agent demo",
      resultCount: 1,
      results: [
        {
          title: "Result One",
          url: "https://example.com/one",
          snippet: "A useful search snippet."
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tvly-test",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("throws a clear error when Tavily rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key"
    });

    await expect(
      searchWeb("agent demo", { apiKey: "bad-key", fetchImpl: fetchMock })
    ).rejects.toThrow("Tavily request failed with 401: invalid api key");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test server/__tests__/tavilySearch.test.ts
```

Expected: fail because `server/tools/tavilySearch.ts` does not exist.

- [ ] **Step 3: Implement Tavily wrapper**

Write `server/tools/tavilySearch.ts`:

```ts
import { getConfig } from "../config.js";
import type { SearchObservation } from "../types.js";

interface SearchOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  maxResults?: number;
}

interface TavilyResponse {
  query?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

export async function searchWeb(query: string, options: SearchOptions = {}): Promise<SearchObservation> {
  const apiKey = options.apiKey ?? getConfig().tavilyApiKey;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) throw new Error("TAVILY_API_KEY is required");

  const response = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: options.maxResults ?? 3,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily request failed with ${response.status}: ${text}`);
  }

  const data = (await response.json()) as TavilyResponse;
  const results = (data.results ?? []).map((result) => ({
    title: result.title ?? "Untitled result",
    url: result.url ?? "",
    snippet: result.content ?? ""
  }));

  return {
    query: data.query ?? query,
    results,
    resultCount: results.length
  };
}
```

- [ ] **Step 4: Run Tavily tests**

Run:

```bash
pnpm test server/__tests__/tavilySearch.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Commit Tavily tool**

```bash
git add server/tools/tavilySearch.ts server/__tests__/tavilySearch.test.ts
git commit -m "feat: add tavily search tool"
```

### Task 5: Minimal ReAct Agent Loop

**Files:**
- Create: `server/agent/reactAgent.ts`
- Create: `server/__tests__/reactAgent.test.ts`

- [ ] **Step 1: Write failing ReAct tests**

Write `server/__tests__/reactAgent.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runReactAgent } from "../agent/reactAgent.js";

describe("runReactAgent", () => {
  it("runs an action step, records observation, and returns a final answer", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "action",
          reason_summary: "需要搜索网页获取最新信息。",
          action: {
            name: "search_web",
            input: { query: "latest agent news" }
          }
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "final",
          answer: "这是基于搜索结果的回答。"
        })
      );

    const searchWeb = vi.fn().mockResolvedValue({
      query: "latest agent news",
      resultCount: 1,
      results: [
        {
          title: "Agent News",
          url: "https://example.com/news",
          snippet: "A concise result."
        }
      ]
    });

    const result = await runReactAgent("发生了什么？", {
      chat,
      searchWeb,
      maxSteps: 3
    });

    expect(result.answer).toBe("这是基于搜索结果的回答。");
    expect(searchWeb).toHaveBeenCalledWith("latest agent news");
    expect(result.trace.map((step) => step.label)).toEqual([
      "reason",
      "action",
      "observation",
      "final"
    ]);
  });

  it("returns a failed trace step when the model does not finish within the limit", async () => {
    const chat = vi.fn().mockResolvedValue(
      JSON.stringify({
        type: "action",
        reason_summary: "继续搜索。",
        action: {
          name: "search_web",
          input: { query: "repeat" }
        }
      })
    );

    const searchWeb = vi.fn().mockResolvedValue({
      query: "repeat",
      resultCount: 0,
      results: []
    });

    const result = await runReactAgent("问题", { chat, searchWeb, maxSteps: 1 });

    expect(result.answer).toBe("");
    expect(result.trace.at(-1)).toMatchObject({
      label: "error",
      status: "failed",
      title: "Step limit reached"
    });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test server/__tests__/reactAgent.test.ts
```

Expected: fail because `server/agent/reactAgent.ts` does not exist.

- [ ] **Step 3: Implement ReAct agent**

Write `server/agent/reactAgent.ts`:

```ts
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

export async function runReactAgent(question: string, options: RunOptions = {}): Promise<AgentRunResult> {
  const chat = options.chat ?? defaultChat;
  const searchWeb = options.searchWeb ?? defaultSearchWeb;
  const maxSteps = options.maxSteps ?? 4;
  const trace: TraceStep[] = [];
  const observations: SearchObservation[] = [];

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const raw = await chat(buildMessages(question, observations));
    const step = parseAgentStep(raw);

    if (step.type === "final") {
      trace.push(makeTraceStep("final", "succeeded", "最终回答", step.answer));
      return { answer: step.answer, trace };
    }

    const query = step.action.input.query;
    trace.push(makeTraceStep("reason", "succeeded", "推理摘要", step.reason_summary));
    trace.push(makeTraceStep("action", "running", "搜索网页", `search_web(${query})`, { query }));

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
  const parsed = JSON.parse(jsonText) as AgentStep;

  if (parsed.type === "final" && typeof parsed.answer === "string") return parsed;
  if (
    parsed.type === "action" &&
    typeof parsed.reason_summary === "string" &&
    parsed.action?.name === "search_web" &&
    typeof parsed.action.input?.query === "string"
  ) {
    return parsed;
  }

  throw new Error(`Invalid agent step: ${raw}`);
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
```

- [ ] **Step 4: Run ReAct tests**

Run:

```bash
pnpm test server/__tests__/reactAgent.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Commit ReAct loop**

```bash
git add server/agent/reactAgent.ts server/__tests__/reactAgent.test.ts
git commit -m "feat: add minimal react agent loop"
```

### Task 6: Health Check, Express API, and CLI

**Files:**
- Create: `server/health.ts`
- Create: `server/index.ts`
- Create: `scripts/health.ts`
- Create: `scripts/chat.ts`
- Create: `scripts/agent.ts`
- Modify: `server/__tests__/health.test.ts`

- [ ] **Step 1: Extend health tests**

Replace `server/__tests__/health.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";
import { getConfig, listMissingConfig } from "../config.js";
import { runHealthCheck } from "../health.js";

describe("config", () => {
  it("uses the OpenAI base URL default", () => {
    const config = getConfig({
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-test",
      TAVILY_API_KEY: "tvly-test"
    });

    expect(config.openaiBaseUrl).toBe("https://api.openai.com/v1");
  });

  it("lists missing required config keys", () => {
    const config = getConfig({});

    expect(listMissingConfig(config)).toEqual([
      "OPENAI_API_KEY",
      "OPENAI_MODEL",
      "TAVILY_API_KEY"
    ]);
  });
});

describe("runHealthCheck", () => {
  it("reports missing config without making network checks", async () => {
    const chat = vi.fn();
    const searchWeb = vi.fn();

    const report = await runHealthCheck({
      config: getConfig({}),
      chat,
      searchWeb
    });

    expect(report.ok).toBe(false);
    expect(report.items.some((item) => item.name === "OPENAI_API_KEY" && !item.ok)).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("reports successful LLM and Tavily probes", async () => {
    const report = await runHealthCheck({
      config: getConfig({
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "demo-model",
        TAVILY_API_KEY: "tvly-test"
      }),
      chat: vi.fn().mockResolvedValue("ok"),
      searchWeb: vi.fn().mockResolvedValue({
        query: "agent demo health check",
        resultCount: 1,
        results: []
      })
    });

    expect(report.ok).toBe(true);
    expect(report.items.every((item) => item.ok)).toBe(true);
  });
});
```

- [ ] **Step 2: Run health tests and verify failure**

Run:

```bash
pnpm test server/__tests__/health.test.ts
```

Expected: fail because `server/health.ts` does not exist.

- [ ] **Step 3: Implement health checker**

Write `server/health.ts`:

```ts
import { getConfig, listMissingConfig, type AppConfig } from "./config.js";
import { chat as defaultChat } from "./lib/llmClient.js";
import { searchWeb as defaultSearchWeb } from "./tools/tavilySearch.js";
import type { HealthItem, HealthReport, SearchObservation } from "./types.js";

interface HealthOptions {
  config?: AppConfig;
  chat?: (messages: Parameters<typeof defaultChat>[0]) => Promise<string>;
  searchWeb?: (query: string) => Promise<SearchObservation>;
}

export async function runHealthCheck(options: HealthOptions = {}): Promise<HealthReport> {
  const config = options.config ?? getConfig();
  const chat = options.chat ?? defaultChat;
  const searchWeb = options.searchWeb ?? defaultSearchWeb;
  const items: HealthItem[] = [];

  const missing = listMissingConfig(config);
  for (const name of ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "TAVILY_API_KEY"]) {
    const ok = name === "OPENAI_BASE_URL" ? Boolean(config.openaiBaseUrl) : !missing.includes(name);
    items.push({
      name,
      ok,
      message: ok ? "configured" : "missing"
    });
  }

  if (missing.length > 0) {
    return { ok: false, items };
  }

  try {
    await chat([{ role: "user", content: "Reply with ok for a health check." }]);
    items.push({ name: "LLM probe", ok: true, message: "request succeeded" });
  } catch (error) {
    items.push({ name: "LLM probe", ok: false, message: formatError(error) });
  }

  try {
    await searchWeb("agent demo health check");
    items.push({ name: "Tavily probe", ok: true, message: "request succeeded" });
  } catch (error) {
    items.push({ name: "Tavily probe", ok: false, message: formatError(error) });
  }

  return {
    ok: items.every((item) => item.ok),
    items
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Implement Express API**

Write `server/index.ts`:

```ts
import cors from "cors";
import express from "express";
import { getConfig } from "./config.js";
import { runReactAgent } from "./agent/reactAgent.js";
import { runHealthCheck } from "./health.js";
import { chat } from "./lib/llmClient.js";
import type { AgentRequest, ChatRequest } from "./types.js";

const app = express();
const config = getConfig();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  response.json(await runHealthCheck());
});

app.post("/api/chat", async (request, response) => {
  try {
    const body = request.body as ChatRequest;
    const answer = await chat(body.messages);
    response.json({ answer });
  } catch (error) {
    response.status(500).json({ error: formatError(error) });
  }
});

app.post("/api/agent", async (request, response) => {
  try {
    const body = request.body as AgentRequest;
    const result = await runReactAgent(body.question);
    response.json(result);
  } catch (error) {
    response.status(500).json({ error: formatError(error) });
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Agent demo API listening on http://127.0.0.1:${config.port}`);
});

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 5: Implement CLI scripts**

Write `scripts/health.ts`:

```ts
import { runHealthCheck } from "../server/health.js";

const report = await runHealthCheck();

for (const item of report.items) {
  const mark = item.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${item.name}: ${item.message}`);
}

process.exitCode = report.ok ? 0 : 1;
```

Write `scripts/chat.ts`:

```ts
import { chat } from "../server/lib/llmClient.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: pnpm chat "你的问题"');
  process.exit(1);
}

const answer = await chat([{ role: "user", content: question }]);
console.log(answer);
```

Write `scripts/agent.ts`:

```ts
import { runReactAgent } from "../server/agent/reactAgent.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: pnpm agent "你的问题"');
  process.exit(1);
}

const result = await runReactAgent(question);

for (const step of result.trace) {
  console.log(`\n[${step.status}] ${step.title}`);
  console.log(step.detail);
}

if (result.answer) {
  console.log(`\nFinal answer:\n${result.answer}`);
}

process.exitCode = result.answer ? 0 : 1;
```

- [ ] **Step 6: Verify server-side checks**

Run:

```bash
pnpm test server/__tests__/health.test.ts
pnpm lint
```

Expected: tests and TypeScript checks pass.

- [ ] **Step 7: Commit API and CLI**

```bash
git add server/health.ts server/index.ts scripts/health.ts scripts/chat.ts scripts/agent.ts server/__tests__/health.test.ts
git commit -m "feat: add health check api and cli demos"
```

### Task 7: Frontend Types, API Client, and Bilingual Copy

**Files:**
- Create: `src/types.ts`
- Create: `src/api.ts`
- Create: `src/i18n.ts`
- Create: `src/__tests__/i18n.test.ts`

- [ ] **Step 1: Create frontend types**

Write `src/types.ts`:

```ts
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
```

- [ ] **Step 2: Create API client**

Write `src/api.ts`:

```ts
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
```

- [ ] **Step 3: Create bilingual copy dictionary**

Write `src/i18n.ts`:

```ts
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
    error: "Error"
  }
} as const;

export function t(language: Language): (typeof copy)[Language] {
  return copy[language];
}
```

- [ ] **Step 4: Test copy lookup**

Write `src/__tests__/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { t } from "../i18n";

describe("i18n copy", () => {
  it("defaults useful Chinese labels through zh lookup", () => {
    expect(t("zh").appTitle).toBe("如何构建一个 Agent");
    expect(t("zh").traceTitle).toBe("执行轨迹");
  });

  it("provides English labels through en lookup", () => {
    expect(t("en").appTitle).toBe("How to Build an Agent");
    expect(t("en").agentMode).toBe("ReAct Agent");
  });
});
```

- [ ] **Step 5: Run frontend utility tests**

Run:

```bash
pnpm test src/__tests__/i18n.test.ts
```

Expected: tests pass.

- [ ] **Step 6: Commit frontend utilities**

```bash
git add src/types.ts src/api.ts src/i18n.ts src/__tests__/i18n.test.ts
git commit -m "feat: add frontend api client and bilingual copy"
```

### Task 8: React UI

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create React entry**

Write `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Create the app UI**

Write `src/App.tsx`:

```tsx
import { Activity, Bot, CheckCircle2, Globe2, Languages, Loader2, MessageSquare, Send, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchHealth, runAgent, sendChat } from "./api";
import { t } from "./i18n";
import type { HealthReport, Language, Mode, TraceStep, UiMessage } from "./types";

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = t(language);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((healthError: unknown) => {
        setHealth({
          ok: false,
          items: [{ name: "health", ok: false, message: formatError(healthError) }]
        });
      });
  }, []);

  const healthLabel = useMemo(() => {
    if (!health) return text.healthFailed;
    if (health.ok) return text.healthReady;
    const hasMissing = health.items.some((item) => item.message === "missing");
    return hasMissing ? text.healthMissing : text.healthFailed;
  }, [health, text.healthFailed, text.healthMissing, text.healthReady]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setInput("");
    setError("");
    setBusy(true);

    if (mode === "chat") {
      const nextMessages = [...messages, { role: "user" as const, content: question }];
      setMessages(nextMessages);
      try {
        const answer = await sendChat(nextMessages);
        setMessages([...nextMessages, { role: "assistant", content: answer }]);
      } catch (chatError) {
        setError(formatError(chatError));
      } finally {
        setBusy(false);
      }
      return;
    }

    setMessages([{ role: "user", content: question }]);
    setTrace([]);
    try {
      const result = await runAgent(question);
      setTrace(result.trace);
      setMessages([
        { role: "user", content: question },
        { role: "assistant", content: result.answer || text.error }
      ]);
    } catch (agentError) {
      setError(formatError(agentError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Bot size={22} />
          <span>{text.appTitle}</span>
        </div>
        <div className="topbar-actions">
          <div className="language-toggle" aria-label="Language">
            <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
          </div>
          <details className={`health ${health?.ok ? "ok" : "bad"}`}>
            <summary>
              {health?.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{healthLabel}</span>
            </summary>
            <div className="health-menu">
              {(health?.items ?? []).map((item) => (
                <div className="health-row" key={item.name}>
                  <strong>{item.ok ? "PASS" : "FAIL"} {item.name}</strong>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </header>

      <section className="modebar">
        <button className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>
          <MessageSquare size={16} />
          {text.chatMode}
        </button>
        <button className={mode === "agent" ? "active" : ""} onClick={() => setMode("agent")}>
          <Activity size={16} />
          {text.agentMode}
        </button>
      </section>

      <section className={mode === "agent" ? "workspace agent-layout" : "workspace"}>
        <div className="panel conversation">
          <div className="panel-title">
            <span>{mode === "chat" ? text.chatMode : text.agentMode}</span>
            <small>{text.corePath}: server/lib/llmClient.ts</small>
          </div>
          <div className="messages">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.content}
              </article>
            ))}
            {busy && (
              <article className="message assistant loading">
                <Loader2 size={16} />
                Running...
              </article>
            )}
            {error && <article className="message error">{error}</article>}
          </div>
          <form className="composer" onSubmit={handleSubmit}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={text.inputPlaceholder} />
            <button type="submit" disabled={busy || !input.trim()}>
              <Send size={16} />
              {mode === "chat" ? text.send : text.run}
            </button>
          </form>
        </div>

        {mode === "agent" && (
          <aside className="panel trace">
            <div className="panel-title">
              <span>{text.traceTitle}</span>
              <Globe2 size={16} />
            </div>
            {trace.length === 0 ? (
              <p className="empty">{text.emptyTrace}</p>
            ) : (
              <ol>
                {trace.map((step) => (
                  <li className={`trace-step ${step.status}`} key={step.id}>
                    <div className="trace-heading">
                      <span>{step.title}</span>
                      <code>{step.status}</code>
                    </div>
                    <p>{step.detail}</p>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        )}
      </section>

      <footer className="footer">
        <Languages size={14} />
        <span>OpenAI-compatible API + Tavily Search</span>
      </footer>
    </main>
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 3: Create styles**

Write `src/styles.css`:

```css
:root {
  color: #1b2430;
  background: #eef2f7;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

.shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
}

.topbar {
  height: 64px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #d9dee8;
  background: #fbfcfe;
}

.brand,
.topbar-actions,
.modebar,
.panel-title,
.footer,
.health summary,
.composer button,
.trace-heading {
  display: flex;
  align-items: center;
}

.brand {
  gap: 10px;
  font-weight: 760;
  font-size: 18px;
}

.topbar-actions {
  gap: 12px;
}

.language-toggle {
  display: flex;
  border: 1px solid #ccd3df;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.language-toggle button,
.modebar button {
  border: 0;
  background: transparent;
  color: #516070;
  cursor: pointer;
}

.language-toggle button {
  padding: 7px 11px;
}

.language-toggle button.active,
.modebar button.active {
  color: #fff;
  background: #111827;
}

.health {
  position: relative;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid #d5dce8;
}

.health summary {
  gap: 7px;
  list-style: none;
  cursor: pointer;
  padding: 7px 11px;
}

.health summary::-webkit-details-marker {
  display: none;
}

.health.ok {
  color: #12643b;
  background: #f0fff4;
  border-color: #b7e4c7;
}

.health.bad {
  color: #933;
  background: #fff5f5;
  border-color: #f0caca;
}

.health-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 5;
  width: 280px;
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #d9dee8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 50px rgb(15 23 42 / 14%);
}

.health-row {
  display: grid;
  gap: 3px;
}

.health-row strong {
  color: #1b2430;
  font-size: 12px;
}

.health-row span {
  color: #667085;
}

.modebar {
  gap: 10px;
  padding: 18px 28px 0;
}

.modebar button {
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid #ccd3df;
  border-radius: 8px;
  background: #fff;
}

.workspace {
  padding: 18px 28px 24px;
  display: grid;
  gap: 16px;
}

.agent-layout {
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
}

.panel {
  min-height: 560px;
  border: 1px solid #d9dee8;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.conversation {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.panel-title {
  justify-content: space-between;
  min-height: 54px;
  padding: 0 16px;
  border-bottom: 1px solid #e4e8f0;
  font-weight: 720;
}

.panel-title small {
  color: #758194;
  font-weight: 500;
}

.messages {
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 12px;
  overflow: auto;
}

.message {
  max-width: 78%;
  padding: 11px 13px;
  border-radius: 8px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.message.user {
  justify-self: end;
  color: #182033;
  background: #e9efff;
}

.message.assistant {
  justify-self: start;
  background: #f8fafc;
  border: 1px solid #e1e6ef;
}

.message.loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message.error {
  justify-self: start;
  color: #933;
  background: #fff5f5;
  border: 1px solid #f0caca;
}

.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid #e4e8f0;
}

.composer input {
  min-height: 42px;
  border: 1px solid #ccd3df;
  border-radius: 8px;
  padding: 0 12px;
  outline: none;
}

.composer input:focus {
  border-color: #111827;
}

.composer button {
  gap: 8px;
  min-width: 108px;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #111827;
  cursor: pointer;
}

.composer button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.trace {
  background: #fbfcfe;
}

.trace ol {
  list-style: none;
  margin: 0;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.trace-step {
  border: 1px solid #d8deea;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
}

.trace-step.failed {
  border-color: #f0caca;
}

.trace-heading {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-weight: 720;
}

.trace-heading code {
  color: #667085;
  background: #f2f4f7;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 12px;
}

.trace-step p,
.empty {
  margin: 0;
  color: #566070;
  line-height: 1.55;
  white-space: pre-wrap;
}

.empty {
  padding: 16px;
}

.footer {
  gap: 7px;
  min-height: 38px;
  padding: 0 28px 18px;
  color: #758194;
  font-size: 13px;
}

@media (max-width: 860px) {
  .topbar {
    height: auto;
    min-height: 64px;
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .modebar,
  .workspace,
  .footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .agent-layout {
    grid-template-columns: 1fr;
  }

  .panel {
    min-height: 460px;
  }
}
```

- [ ] **Step 4: Run UI typecheck**

Run:

```bash
pnpm lint
```

Expected: TypeScript checks pass.

- [ ] **Step 5: Commit UI**

```bash
git add src/main.tsx src/App.tsx src/styles.css
git commit -m "feat: add bilingual agent demo ui"
```

### Task 9: End-to-End Verification

**Files:**
- Modify only files required by failures discovered in this task.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all commands pass.

- [ ] **Step 2: Run health check with real env**

Create `.env` locally from `.env.example`, fill real keys, then run:

```bash
pnpm health
```

Expected with valid credentials:

```text
PASS OPENAI_BASE_URL: configured
PASS OPENAI_API_KEY: configured
PASS OPENAI_MODEL: configured
PASS TAVILY_API_KEY: configured
PASS LLM probe: request succeeded
PASS Tavily probe: request succeeded
```

- [ ] **Step 3: Run pure LLM CLI demo**

Run:

```bash
pnpm chat "用一句话解释什么是生成式 LLM"
```

Expected: a single assistant answer in Chinese.

- [ ] **Step 4: Run ReAct CLI demo**

Run:

```bash
pnpm agent "搜索一个需要最新信息的问题并总结"
```

Expected: console output includes at least one `推理摘要`, one `搜索网页`, one `观察`, and a final answer.

- [ ] **Step 5: Run local web app**

Run:

```bash
pnpm dev
```

Expected:

- API server prints `Agent demo API listening on http://127.0.0.1:8787`.
- Vite prints a local URL for `http://127.0.0.1:5173`.

- [ ] **Step 6: Browser verification**

Open `http://127.0.0.1:5173` and verify:

- Default UI language is Chinese.
- `中文 / EN` toggle switches visible labels.
- `纯 LLM 对话` sends a chat request and displays the answer.
- `ReAct Agent` sends an agent request and displays a right-side trace timeline.
- Trace includes `推理摘要`, `搜索网页`, `观察`, and `最终回答`.
- Health badge shows `服务可用` when real probes pass.

- [ ] **Step 7: Stop dev server**

Stop `pnpm dev` with `Ctrl-C`.

Expected: no long-running dev server remains.

- [ ] **Step 8: Commit verification fixes**

If Step 1 through Step 6 required code fixes, commit them:

```bash
git add .
git commit -m "fix: complete stage 1 demo verification"
```

If no fixes were required, do not create an empty commit.

## Self-Review

Spec coverage:

- Pure LLM demo is covered by Tasks 3, 6, 8, and 9.
- ReAct agent with reasoning/action is covered by Tasks 4, 5, 6, 8, and 9.
- Tavily real search action is covered by Tasks 4 and 9.
- Web + CLI runtime shape is covered by Tasks 6, 8, and 9.
- Chinese-first UI and English toggle are covered by Tasks 7 and 8.
- Health check is covered by Tasks 6 and 9.
- Non-goals are preserved by excluding memory, perception, browser automation, LangChain, LlamaIndex, and fabricated fallback data from all tasks.

Type consistency:

- Server and UI both use `TraceStep.status` values `running`, `succeeded`, and `failed`.
- Agent trace labels match the UI display path.
- CLI scripts call the same server modules used by the API.
- The Tavily wrapper matches the current Tavily Search API shape: `POST https://api.tavily.com/search` with bearer authorization and `query`, `search_depth`, `max_results`, `include_answer`, and `include_raw_content` in the JSON body.
