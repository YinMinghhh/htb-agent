import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Globe2,
  Languages,
  Loader2,
  MessageSquare,
  Send,
  XCircle
} from "lucide-react";
import { fetchHealth, runAgent, sendChat } from "./api";
import { t } from "./i18n";
import type { HealthReport, Language, Mode, TraceStep, UiMessage } from "./types";

const initialMessages: UiMessage[] = [
  {
    role: "assistant",
    content: "你好，我是这个 Agent 教学 Demo 的助手。你可以先问一个普通问题，再切换到 ReAct Agent 看执行轨迹。"
  }
];

const sampleQuestions = {
  zh: ["解释一下 ReAct Agent 的循环", "我该如何给 Agent 添加工具？"],
  en: ["Explain the ReAct Agent loop", "How should I add tools to an agent?"]
} satisfies Record<Language, string[]>;

function traceIcon(step: TraceStep) {
  if (step.status === "running") return <Loader2 className="spin" aria-hidden="true" />;
  if (step.status === "failed" || step.label === "error") return <XCircle aria-hidden="true" />;
  return <CheckCircle2 aria-hidden="true" />;
}

function formatTraceLabel(label: TraceStep["label"]) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function HealthBadge({ health, fallbackLabel }: { health?: HealthReport; fallbackLabel: string }) {
  if (!health) {
    return (
      <span className="health health-unknown">
        <Activity aria-hidden="true" />
        {fallbackLabel}
      </span>
    );
  }

  return (
    <span className={health.ok ? "health health-ok" : "health health-bad"}>
      {health.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
      {fallbackLabel}
    </span>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [health, setHealth] = useState<HealthReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = t(language);
  const healthLabel = useMemo(() => {
    if (!health) return copy.healthFailed;
    return health.ok ? copy.healthReady : copy.healthMissing;
  }, [copy.healthFailed, copy.healthMissing, copy.healthReady, health]);

  useEffect(() => {
    let ignore = false;

    fetchHealth()
      .then((report) => {
        if (!ignore) setHealth(report);
      })
      .catch(() => {
        if (!ignore) {
          setHealth({ ok: false, items: [{ name: "api", ok: false, message: copy.healthFailed }] });
        }
      });

    return () => {
      ignore = true;
    };
  }, [copy.healthFailed]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    const nextMessages = [...messages, { role: "user", content: question } satisfies UiMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setBusy(true);

    try {
      if (mode === "chat") {
        const answer = await sendChat(nextMessages);
        setMessages((current) => [...current, { role: "assistant", content: answer }]);
        return;
      }

      setTrace([
        {
          id: "pending",
          label: "reason",
          status: "running",
          title: copy.corePath,
          detail: language === "zh" ? "正在规划下一步..." : "Planning the next step..."
        }
      ]);
      const result = await runAgent(question);
      setTrace(result.trace);
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      if (mode === "agent") {
        setTrace((current) => [
          ...current.filter((step) => step.id !== "pending"),
          {
            id: "error",
            label: "error",
            status: "failed",
            title: copy.error,
            detail: message
          }
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Bot aria-hidden="true" />
          <div>
            <p>{copy.corePath}</p>
            <h1>{copy.appTitle}</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <details className="health-details">
            <summary>
              <HealthBadge health={health} fallbackLabel={healthLabel} />
            </summary>
            <div className="health-menu">
              {(health?.items ?? []).map((item) => (
                <div className="health-row" key={item.name}>
                  {item.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                  <span>{item.name}</span>
                  <small>{item.message}</small>
                </div>
              ))}
            </div>
          </details>

          <button
            className="icon-button language-button"
            type="button"
            onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
            title={language === "zh" ? "Switch to English" : "切换到中文"}
            aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
          >
            <Languages aria-hidden="true" />
            <span>{language === "zh" ? "EN" : "中"}</span>
          </button>
        </div>
      </header>

      <section className="mode-switch" aria-label="Mode">
        <button
          className={mode === "chat" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => setMode("chat")}
        >
          <MessageSquare aria-hidden="true" />
          <span>{copy.chatMode}</span>
        </button>
        <button
          className={mode === "agent" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => setMode("agent")}
        >
          <Bot aria-hidden="true" />
          <span>{copy.agentMode}</span>
        </button>
      </section>

      <section className={mode === "agent" ? "workspace workspace-agent" : "workspace"}>
        <section className="panel conversation-panel" aria-label="Conversation">
          <div className="panel-header">
            <div>
              <p>{mode === "chat" ? copy.chatMode : copy.agentMode}</p>
              <h2>{language === "zh" ? "对话" : "Conversation"}</h2>
            </div>
            {mode === "chat" ? <MessageSquare aria-hidden="true" /> : <Globe2 aria-hidden="true" />}
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? (language === "zh" ? "你" : "You") : "Assistant"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {busy ? (
              <article className="message assistant">
                <span>Assistant</span>
                <p className="typing">
                  <Loader2 className="spin" aria-hidden="true" />
                  {language === "zh" ? "处理中..." : "Working..."}
                </p>
              </article>
            ) : null}
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <XCircle aria-hidden="true" />
              <span>{copy.error}: {error}</span>
            </div>
          ) : null}

          <div className="quick-prompts" aria-label="Suggested questions">
            {sampleQuestions[language].map((question) => (
              <button key={question} type="button" onClick={() => setInput(question)} disabled={busy}>
                {question}
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.inputPlaceholder}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              <span>{mode === "chat" ? copy.send : copy.run}</span>
            </button>
          </form>
        </section>

        {mode === "agent" ? (
          <aside className="panel trace-panel" aria-label={copy.traceTitle}>
            <div className="panel-header">
              <div>
                <p>ReAct</p>
                <h2>{copy.traceTitle}</h2>
              </div>
              <Activity aria-hidden="true" />
            </div>

            <div className="trace-list">
              {trace.length === 0 ? (
                <div className="trace-empty">{copy.emptyTrace}</div>
              ) : (
                trace.map((step) => (
                  <article className={`trace-step ${step.status}`} key={step.id}>
                    <div className="trace-icon">{traceIcon(step)}</div>
                    <div>
                      <span>{formatTraceLabel(step.label)}</span>
                      <h3>{step.title}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
