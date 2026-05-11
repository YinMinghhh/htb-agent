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
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "demo-model",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.2
    });
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

  it("omits unsafe upstream error text instead of leaking prompts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ messages: [{ content: "private prompt text" }] })
    });

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.toThrow("LLM request failed with 400: upstream response body omitted");

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.not.toThrow("private prompt text");
  });

  it("does not leak bearer tokens from upstream error text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "BEARER abc+def/ghi=="
    });

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.toThrow("LLM request failed with 500: upstream response body omitted");

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.not.toThrow(/abc|def|ghi/);
  });

  it("omits arbitrary short plaintext error text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "secret: my home address is 1 Main St"
    });

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.toThrow("LLM request failed with 403: upstream response body omitted");

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
        {
          config: {
            openaiBaseUrl: "https://example.test/v1",
            openaiApiKey: "sk-secret",
            openaiModel: "demo-model",
            tavilyApiKey: "tvly-test",
            port: 8787
          },
          fetchImpl: fetchMock
        }
      )
    ).rejects.not.toThrow("1 Main St");
  });

  it("allows empty assistant content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "" } }]
      })
    });

    await expect(
      chat(
        [{ role: "user", content: "hello" }],
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
      )
    ).resolves.toBe("");
  });
});
