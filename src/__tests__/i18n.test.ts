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
