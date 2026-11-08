import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { findAlignedTopologyCandidate } from "../lib/utils/high-density-force-improve-topology"

test("RVboy rejects local alignments that cannot change an unrelated protected collision", (): void => {
  const input = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL(
            "./fixtures/rvboy-impossible-alignment.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ).toString(),
  ) as Parameters<typeof findAlignedTopologyCandidate>[0]
  const original = JSON.stringify(input)
  expect(input.originalRoutes).toHaveLength(24)
  expect(
    input.originalRoutes.reduce(
      (count, route) => count + route.route.length,
      0,
    ),
  ).toBe(5442)
  expect(input.crossingSelectors).toHaveLength(238)
  // The previous implementation invoked full projection for these candidates,
  // even though their unchanged protected pair already proved them impossible.
  const result = findAlignedTopologyCandidate(input, () => {
    throw new Error(
      "An unchanged protected collision cannot be repaired by projection",
    )
  })
  expect(result).toBeUndefined()
  expect(JSON.stringify(input)).toBe(original)
})
