import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completionSeenInChunks } from '../server/utils/sse.ts'

test('recognizes a DONE marker split across SSE chunks', () => {
  const state = { tail: '', done: false }
  completionSeenInChunks(state, 'data: {"choices":[{}]}\n\ndata: [DO')
  completionSeenInChunks(state, 'NE]\n\n')
  assert.equal(state.done, true)
})

test('does not mark a stream complete without a DONE marker', () => {
  const state = { tail: '', done: false }
  completionSeenInChunks(state, 'data: {"choices":[{"finish_reason":"stop"}]}\n\n')
  assert.equal(state.done, false)
})
