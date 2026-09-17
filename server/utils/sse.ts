export interface SseCompletionState { tail: string; done: boolean }

/** Track an SSE completion marker even when network chunks split the marker. */
export function completionSeenInChunks(state: SseCompletionState, chunk: string): void {
  if (state.done) return
  const text = state.tail + chunk
  state.done = /(?:^|\n)data:\s*\[DONE\](?:\r?\n|$)/.test(text)
  state.tail = text.slice(-64)
}
