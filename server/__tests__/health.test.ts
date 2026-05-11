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
