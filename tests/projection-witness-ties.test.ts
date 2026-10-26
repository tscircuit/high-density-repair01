import { expect, test } from "bun:test"
import { getClosestProjectionSegmentDistanceCandidate } from "lib/utils/force-improve-segment-helpers"

test("equal rounded distances retain the first geometric witness", () => {
  for (const offset of [1, 1 + Number.EPSILON, 1 - Number.EPSILON / 2]) {
    const left = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }
    const right = { start: { x: 0, y: offset }, end: { x: 10, y: offset } }
    expect(getClosestProjectionSegmentDistanceCandidate(left, right)).toEqual({
      leftT: 0,
      rightT: 0,
      leftPoint: { x: 0, y: 0 },
      rightPoint: { x: 0, y: offset },
    })
  }
})
