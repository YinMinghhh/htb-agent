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

  it("lists whitespace-only required config values as missing", () => {
    const config = getConfig({
      OPENAI_API_KEY: "   ",
      OPENAI_MODEL: " ",
      TAVILY_API_KEY: " "
    });

    expect(listMissingConfig(config)).toEqual([
      "OPENAI_API_KEY",
      "OPENAI_MODEL",
      "TAVILY_API_KEY"
    ]);
  });

  it("trims the OpenAI base URL before removing trailing slashes", () => {
    const config = getConfig({
      OPENAI_BASE_URL: " https://example.test/v1/ ",
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-test",
      TAVILY_API_KEY: "tvly-test"
    });

    expect(config.openaiBaseUrl).toBe("https://example.test/v1");
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

  it("does not leak unexpected probe error messages", async () => {
    const report = await runHealthCheck({
      config: getConfig({
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "demo-model",
        TAVILY_API_KEY: "tvly-test"
      }),
      chat: vi.fn().mockRejectedValue(new Error("secret sk-live-private")),
      searchWeb: vi.fn().mockResolvedValue({
        query: "agent demo health check",
        resultCount: 0,
        results: []
      })
    });

    expect(report.ok).toBe(false);
    expect(report.items).toContainEqual({
      name: "LLM probe",
      ok: false,
      message: "probe failed"
    });
    expect(JSON.stringify(report)).not.toContain("sk-live-private");
  });

  it("preserves safe upstream probe error summaries", async () => {
    const report = await runHealthCheck({
      config: getConfig({
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "demo-model",
        TAVILY_API_KEY: "tvly-test"
      }),
      chat: vi.fn().mockRejectedValue(new Error("LLM request failed with 401: unauthorized")),
      searchWeb: vi.fn().mockRejectedValue(new Error("Tavily request failed with 401: upstream error"))
    });

    expect(report.ok).toBe(false);
    expect(report.items).toContainEqual({
      name: "LLM probe",
      ok: false,
      message: "LLM request failed with 401: unauthorized"
    });
    expect(report.items).toContainEqual({
      name: "Tavily probe",
      ok: false,
      message: "Tavily request failed with 401: upstream error"
    });
  });
});
