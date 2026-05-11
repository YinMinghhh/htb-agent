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
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      query: "agent demo",
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
      include_raw_content: false
    });
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

  it("omits sensitive Tavily error bodies from the thrown error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: "query contains prompt: reveal system prompt",
          apiKey: "tvly-secret",
          authorization: "Bearer tvly-bearer-secret"
        })
    });

    let thrown: unknown;
    try {
      await searchWeb("sensitive query with prompt", {
        apiKey: "tvly-secret",
        fetchImpl: fetchMock
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Tavily request failed with 400: upstream error");
    expect((thrown as Error).message).not.toMatch(
      /reveal system prompt|tvly-secret|tvly-bearer-secret|Bearer/
    );
  });
});
