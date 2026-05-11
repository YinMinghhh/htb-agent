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
