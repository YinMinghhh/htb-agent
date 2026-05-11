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

let healthCache: HealthReport | undefined;
let healthRequest: Promise<HealthReport> | undefined;

function getHealthOnce() {
  if (healthCache) return Promise.resolve(healthCache);

  healthRequest ??= fetchHealth()
    .then((report) => {
      healthCache = report;
      return report;
    })
    .catch((caught: unknown) => {
      healthRequest = undefined;
      throw caught;
    });

  return healthRequest;
}

function traceIcon(step: TraceStep) {
  if (step.status === "running") return <Loader2 className="spin" aria-hidden="true" />;
  if (step.status === "failed" || step.label === "error") return <XCircle aria-hidden="true" />;
  return <CheckCircle2 aria-hidden="true" />;
}

function formatTraceLabel(label: TraceStep["label"], copy: ReturnType<typeof t>) {
  const labels = {
    reason: copy.traceReason,
    action: copy.traceAction,
    observation: copy.traceObservation,
    final: copy.traceFinal,
    error: copy.error
  } satisfies Record<TraceStep["label"], string>;

  return labels[label];
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

function getHealthLabel(health: HealthReport | undefined, copy: ReturnType<typeof t>) {
  if (!health) return copy.healthChecking;
  if (health.ok) return copy.healthReady;
  return health.items.some((item) => item.message === "missing") ? copy.healthMissing : copy.healthFailed;
}

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [health, setHealth] = useState<HealthReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = t(language);
  const healthLabel = useMemo(() => getHealthLabel(health, copy), [copy, health]);

  useEffect(() => {
    let ignore = false;

    getHealthOnce()
      .then((report) => {
        if (!ignore) setHealth(report);
      })
      .catch((caught: unknown) => {
        if (!ignore) {
          const message = caught instanceof Error ? caught.message : String(caught);
          setHealth({ ok: false, items: [{ name: "api", ok: false, message }] });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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
        const answer = (await sendChat(nextMessages)).trim() || copy.chatNoAnswer;
        setMessages((current) => [...current, { role: "assistant", content: answer }]);
        return;
      }

      setTrace([
        {
          id: "pending",
          label: "reason",
          status: "running",
          title: copy.corePath,
          detail: copy.running
        }
      ]);
      const result = await runAgent(question);
      setTrace(result.trace);
      const answer = result.answer.trim() || copy.agentNoAnswer;
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
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

      <section className="mode-switch" aria-label={copy.modeSwitchLabel}>
        <button
          className={mode === "chat" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => setMode("chat")}
          disabled={busy}
        >
          <MessageSquare aria-hidden="true" />
          <span>{copy.chatMode}</span>
        </button>
        <button
          className={mode === "agent" ? "mode-button active" : "mode-button"}
          type="button"
          onClick={() => setMode("agent")}
          disabled={busy}
        >
          <Bot aria-hidden="true" />
          <span>{copy.agentMode}</span>
        </button>
      </section>

      <section className={mode === "agent" ? "workspace workspace-agent" : "workspace"}>
        <section className="panel conversation-panel" aria-label={mode === "chat" ? copy.chatMode : copy.agentMode}>
          <div className="panel-header">
            <div>
              <p>{copy.corePath}</p>
              <h2>{mode === "chat" ? copy.chatMode : copy.agentMode}</h2>
            </div>
            {mode === "chat" ? <MessageSquare aria-hidden="true" /> : <Globe2 aria-hidden="true" />}
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <p>{message.content}</p>
              </article>
            ))}
            {busy ? (
              <article className="message assistant">
                <p className="typing">
                  <Loader2 className="spin" aria-hidden="true" />
                  {copy.running}
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
                <p>{copy.agentMode}</p>
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
                      <span>{formatTraceLabel(step.label, copy)}</span>
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
      <footer className="app-footer">
        <Languages aria-hidden="true" />
        <span>{copy.footerText}</span>
      </footer>
    </main>
  );
}
