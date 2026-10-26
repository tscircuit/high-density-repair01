import { expect, test } from "bun:test"
import {
  getClosestProjectionSegmentDistanceCandidate,
  getProjectionSegmentDistanceCandidates,
} from "lib/utils/force-improve-segment-helpers"

test("closest selection preserves degenerate and multi-scale segment witnesses", () => {
  for (const scale of [1e-150, 1e-40, 1e-4, 1, 1e10, 1e60]) {
    const point = { x: 3 * scale, y: -2 * scale }
    const line = {
      start: { x: -2 * scale, y: 4 * scale },
      end: { x: 7 * scale, y: -3 * scale },
    }
    const cases = [
      [{ start: point, end: point }, line],
      [line, { start: point, end: point }],
      [
        { start: point, end: point },
        { start: { x: scale, y: scale }, end: { x: scale, y: scale } },
      ],
      [
        line,
        {
          start: { x: scale, y: -4 * scale },
          end: { x: 5 * scale, y: 6 * scale },
        },
      ],
    ]
    for (const [left, right] of cases) {
      const expected = getProjectionSegmentDistanceCandidates(left!, right!)[0]
      expect(
        getClosestProjectionSegmentDistanceCandidate(left!, right!),
      ).toEqual(expected)
    }
  }
})
