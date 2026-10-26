import { expect, test } from "bun:test"
import {
  getClosestProjectionSegmentDistanceCandidate,
  getProjectionSegmentDistanceCandidates,
} from "lib/utils/force-improve-segment-helpers"
import fixture from "./fixtures/projection-witness-control.json"

test("closest witnesses and the full sorted API match the exact control fixtures", () => {
  expect(fixture.sourceRevision).toBe("27b3392c38ed4474b0557c73640b261155e28c27")
  for (const input of fixture.cases) {
    const sorted = getProjectionSegmentDistanceCandidates(input.left, input.right, input.epsilon)
    expect(sorted).toEqual(input.expected)
    expect(getClosestProjectionSegmentDistanceCandidate(input.left, input.right, input.epsilon)).toEqual(input.expected[0])
  }
})
