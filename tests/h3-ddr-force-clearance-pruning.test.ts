import { expect, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import * as segmentHelpers from "lib/utils/force-improve-segment-helpers"
import * as topology from "lib/utils/high-density-force-improve-topology"

type CapturedForceInput = {
  input: ConstructorParameters<typeof HighDensityForceImproveSolver>[0]
  expectedViolatingRoutePairs: [number, number][]
}

type SegmentDistanceCandidates = ReturnType<
  typeof segmentHelpers.getProjectionSegmentDistanceCandidates
>

test("H3 DDR clearance prunes distant pairs", (): void => {
  const captured = JSON.parse(
    gunzipSync(
      Uint8Array.from(
        readFileSync(
          new URL(
            "./fixtures/h3-ddr-cmn9-force-input.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ).toString(),
  ) as CapturedForceInput
  const { hdRoutes, nodeWithPortPoints } = captured.input
  const originalInput = JSON.stringify(captured.input)
  expect(hdRoutes).toHaveLength(23)
  expect(
    hdRoutes.reduce((sum, route): number => sum + route.route.length, 0),
  ).toBe(2459)
  expect(nodeWithPortPoints[0]!.capacityMeshNodeId).toBe("cmn_9")

  const exactDistance = segmentHelpers.getProjectionSegmentDistanceCandidates
  let witnessCalls = 0
  const witness = spyOn(
    segmentHelpers,
    "getProjectionSegmentDistanceCandidates",
  ).mockImplementation((...args): SegmentDistanceCandidates => {
    witnessCalls++
    if (witnessCalls > 10_000) {
      throw new Error(
        "H3 topology clearance exceeded 10,000 exact distance checks",
      )
    }
    return exactDistance(...args)
  })
  try {
    // Enter through the existing topology guard. Even without candidate moves,
    // it validates baseline clearance before considering alignment selectors.
    expect(
      topology.findAlignedTopologyCandidate(
        {
          originalRoutes: hdRoutes,
          guardedRoutes: hdRoutes,
          node: nodeWithPortPoints[0]!,
          crossingSelectors: [],
          protectedSelectors: [],
        },
        (): never => {
          throw new Error("No alignment candidate requested projection")
        },
      ),
    ).toBeUndefined()
    expect(witnessCalls).toBeGreaterThan(0)
    expect(witnessCalls).toBeLessThan(10_000)

    witnessCalls = 0
    // Recorded with the original unfiltered predicate at dependency 27b3392.
    expect(topology.getRoutePairClearanceViolations(hdRoutes)).toEqual(
      captured.expectedViolatingRoutePairs,
    )
    expect(witnessCalls).toBeGreaterThan(0)
    expect(witnessCalls).toBeLessThan(10_000)
  } finally {
    witness.mockRestore()
  }
  expect(JSON.stringify(captured.input)).toBe(originalInput)
})
