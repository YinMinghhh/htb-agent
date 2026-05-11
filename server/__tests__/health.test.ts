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
