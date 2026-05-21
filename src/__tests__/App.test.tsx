import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { fetchHealth, runAgent, sendChat } from "../api";

vi.mock("../api", () => ({
  fetchHealth: vi.fn(),
  sendChat: vi.fn(),
  runAgent: vi.fn()
}));

const mockedFetchHealth = vi.mocked(fetchHealth);
const mockedSendChat = vi.mocked(sendChat);
const mockedRunAgent = vi.mocked(runAgent);

describe("App conversation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchHealth.mockResolvedValue({ ok: true, items: [] });
  });

  it("renders assistant markdown instead of exposing raw markdown source", async () => {
    mockedSendChat.mockResolvedValue("简要结论：**Kimi Claw**\\n\\n- 官方云端工作区");

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("输入一个问题..."), {
      target: { value: "Kimi Claw 是什么？" }
    });
    fireEvent.click(screen.getByRole("button", { name: /发送/ }));

    const strongText = await screen.findByText("Kimi Claw");

    expect(strongText.tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*Kimi Claw\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\\n\\n/)).not.toBeInTheDocument();
    expect(screen.getByText("官方云端工作区")).toBeInTheDocument();
  });

  it("keeps pure chat and ReAct agent conversations separate across mode switches", async () => {
    mockedSendChat.mockResolvedValue("纯 LLM 回答");
    mockedRunAgent.mockResolvedValue({ answer: "ReAct Agent 回答", trace: [] });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("输入一个问题..."), {
      target: { value: "先问纯 LLM" }
    });
    fireEvent.click(screen.getByRole("button", { name: /发送/ }));

    expect(await screen.findByText("纯 LLM 回答")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ReAct Agent" }));

    const agentPanel = screen.getByRole("region", { name: "ReAct Agent" });
    expect(within(agentPanel).queryByText("纯 LLM 回答")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("输入一个问题..."), {
      target: { value: "再问 Agent" }
    });
    fireEvent.click(screen.getByRole("button", { name: /运行/ }));

    expect(await within(agentPanel).findByText("ReAct Agent 回答")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "纯 LLM 对话" }));

    const chatPanel = screen.getByRole("region", { name: "纯 LLM 对话" });
    expect(within(chatPanel).getByText("纯 LLM 回答")).toBeInTheDocument();
    expect(within(chatPanel).queryByText("ReAct Agent 回答")).not.toBeInTheDocument();
  });
});
