import { expect, test } from "bun:test"
import "bun-match-svg"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"

type Input = ConstructorParameters<typeof HighDensityForceImproveSolver>[0]
type Route = Input["hdRoutes"][number]

test("RVboy regional detours survive subsequent node-local force cleanup", async (): Promise<void> => {
  // Exact worker input for cmn_439, with full board obstacles retained as
  // visualization context. The source region ID survives regional rerouting.
  const fixture = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL("./fixtures/rvboy-regional-cleanup.json.gz", import.meta.url),
        ),
      ),
    ).toString(),
  ) as { input: Input; beforeRoutes: Route[] }
  const original = structuredClone(fixture.input)
  const solver = new HighDensityForceImproveSolver(fixture.input)
  solver.solve()
  expect(solver.solved).toBeTrue()
  expect(solver.failed).toBeFalse()
  expect(solver.getOutput()).toEqual(original.hdRoutes)
  expect(fixture.input).toEqual(original)
  expect(solver.sampleEntries).toHaveLength(0)
  const beforeVia = fixture.beforeRoutes[2]!.vias[0]!
  const afterVia = solver.getOutput()[2]!.vias[0]!
  // Ground via: centre (0, 11), radius .3; signal via radius .225.
  expect(Math.hypot(beforeVia.x, beforeVia.y - 11) - 0.3 - 0.225).toBeLessThan(
    0.1,
  )
  expect(Math.hypot(afterVia.x, afterVia.y - 11) - 0.3 - 0.225).toBeGreaterThan(
    0.1,
  )
  for (const [name, routes] of [
    ["before", fixture.beforeRoutes],
    ["after", solver.getOutput()],
  ] as const) {
    const node = fixture.input.nodeWithPortPoints[0]!
    const graphics: GraphicsObject = {
      rects: [
        {
          center: node.center,
          width: node.width,
          height: node.height,
          stroke: "#64748b",
          fill: "none",
          label: "Original node",
        },
      ],
      lines: routes.flatMap((route) =>
        route.route.slice(1).flatMap((point, index) => {
          const previous = route.route[index]!
          return previous.z === point.z
            ? [
                {
                  points: [previous, point],
                  strokeColor:
                    route.connectionName === "source_net_55_mst1"
                      ? "#2563eb"
                      : "#a855f7",
                  strokeWidth: route.traceThickness,
                },
              ]
            : []
        }),
      ),
      circles: [
        {
          center: { x: 0, y: 11 },
          radius: 0.3,
          fill: "#ef4444",
          label: "Retained ground via",
        },
        ...routes.flatMap((route) =>
          route.vias.map((via) => ({
            center: via,
            radius: route.viaDiameter / 2,
            fill: "#2563eb",
          })),
        ),
      ],
      title:
        name === "before"
          ? "Before: local cleanup pulls the signal via back into ground copper"
          : "After: regional detour and its clearance are preserved",
    }
    // The same viewport includes both the legal detour and original node.
    graphics.rects!.push({
      center: { x: 0.7, y: 9.8 },
      width: 3.2,
      height: 4.5,
      stroke: "none",
      fill: "none",
    })
    await expect(
      `<svg width="700" height="780" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="20" y="30" font-family="sans-serif" font-size="20">RVboy: preserve regional clearance during cleanup</text><text x="20" y="58" font-family="sans-serif" font-size="15">${name === "before" ? "Before: cleanup pulls the signal via toward the ground via" : "After: the validated regional detour stays intact"}</text>${getSvgFromGraphicsObject(
        graphics,
        {
          backgroundColor: "white",
          svgWidth: 700,
          svgHeight: 700,
          includeTextLabels: false,
        },
      ).replace("<svg ", '<svg y="80" ')}</svg>`,
    ).toMatchSvgSnapshot(import.meta.path, name)
  }
})
