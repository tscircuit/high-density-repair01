import { expect, test } from "bun:test"
import { stackGraphicsHorizontally, type GraphicsObject } from "graphics-debug"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "lib/types/high-density-types"
import fixture from "./fixtures/ov9281-gap-force-input.json"

const getTargetVia = (routes: HighDensityRoute[]): { x: number; y: number } => {
  const route = routes.find(
    (route) => route.connectionName === "source_trace_66__source_net_66_mst0",
  )
  if (!route) throw new Error("Missing OV9281 target route")
  const via = route.route.find((point, index) => {
    const next = route.route[index + 1]
    return (
      next && point.z !== next.z && point.x === next.x && point.y === next.y
    )
  })
  if (!via) throw new Error("Missing OV9281 target via")
  return via
}

const getPadClearance = (
  via: { x: number; y: number },
  radius: number,
): number => {
  const pad = fixture.adjacentPad
  const dx = Math.max(Math.abs(via.x - pad.center.x) - pad.width / 2, 0)
  const dy = Math.max(Math.abs(via.y - pad.center.y) - pad.height / 2, 0)
  return Math.hypot(dx, dy) - radius
}

const createReproGraphics = ({
  routes,
  title,
}: {
  routes: HighDensityRoute[]
  title: string
}): GraphicsObject => {
  const route = routes.find(
    (route) => route.connectionName === "source_trace_66__source_net_66_mst0",
  )
  if (!route) throw new Error("Missing OV9281 target route")
  const node = fixture.nodeWithPortPoints[0]!
  return {
    title,
    coordinateSystem: "cartesian",
    rects: [
      {
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "#94a3b8",
        fill: "rgba(148,163,184,0.12)",
        label: "Free region",
      },
      {
        center: fixture.adjacentPad.center,
        width: fixture.adjacentPad.width,
        height: fixture.adjacentPad.height,
        stroke: "#dc2626",
        fill: "rgba(220,38,38,0.2)",
        label: fixture.adjacentPad.pcb_smtpad_id,
      },
    ],
    lines: route.route
      .slice(1)
      .flatMap((end, index): NonNullable<GraphicsObject["lines"]> => {
        const start = route.route[index]!
        if (start.z !== end.z) return []
        return [
          {
            points: [start, end],
            strokeColor: "#2563eb",
            strokeWidth: route.traceThickness,
            strokeDash: start.z === 0 ? undefined : [0.03, 0.03],
          },
        ]
      }),
    circles: [
      {
        center: getTargetVia(routes),
        radius: route.viaDiameter / 2,
        fill: "rgba(37,99,235,0.2)",
        stroke: "#2563eb",
      },
    ],
  }
}

test("reproduce segment projection moving the OV9281 via into a pad", async (): Promise<void> => {
  const solver = new HighDensityForceImproveSolver(structuredClone(fixture))
  const node = fixture.nodeWithPortPoints[0]!
  const radius = fixture.hdRoutes[0]!.viaDiameter / 2
  const before = getTargetVia(fixture.hdRoutes)
  expect(before.y - radius).toBeGreaterThanOrEqual(
    node.center.y - node.height / 2,
  )
  expect(getPadClearance(before, radius)).toBeGreaterThan(0)

  solver.solve()
  expect(solver.solved).toBe(true)
  const after = getTargetVia(solver.getOutput())
  expect(getPadClearance(after, radius)).toBeLessThan(0)

  await expect(
    stackGraphicsHorizontally(
      [
        createReproGraphics({
          routes: fixture.hdRoutes,
          title: "Before cleanup",
        }),
        createReproGraphics({
          routes: solver.getOutput(),
          title: "After cleanup",
        }),
      ],
      { titles: ["Before cleanup", "After cleanup"] },
    ),
  ).toMatchGraphicsSvg(import.meta.path)
})
