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
