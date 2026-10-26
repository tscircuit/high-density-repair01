import { expect, test } from "bun:test"
import { getClosestProjectionSegmentDistanceCandidate } from "lib/utils/force-improve-segment-helpers"

test("unrepresentable segment distances surface an invariant failure", () => {
  const right = { start: { x: 0, y: 1 }, end: { x: 2, y: 1 } }
  for (const invalidX of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    const left = { start: { x: invalidX, y: 0 }, end: { x: 2, y: 0 } }
    expect(() =>
      getClosestProjectionSegmentDistanceCandidate(left, right),
    ).toThrow("Projection segment distance must be finite")
  }
  expect(() =>
    getClosestProjectionSegmentDistanceCandidate(
      { start: { x: 1e200, y: 0 }, end: { x: -1e200, y: 1e200 } },
      right,
    ),
  ).toThrow("Projection segment distance must be finite")
})
