export function formatPublicError(
  error: unknown,
  fallbackMessage = "Unexpected server error"
): string {
  if (!(error instanceof Error)) return fallbackMessage;
  if (isSafeUpstreamError(error.message)) return error.message;
  return fallbackMessage;
}

function isSafeUpstreamError(message: string): boolean {
  return (
    /^LLM request failed with \d{3}: (unauthorized|forbidden|not found|too many requests|rate limit exceeded|bad request|invalid request|server error|service unavailable|upstream response body omitted)$/i.test(
      message
    ) ||
    /^Tavily request failed with \d{3}: (invalid api key\.?|upstream error)$/i.test(message)
  );
}
