import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

/** Physical pad geometry in routing coordinates, with explicit board layers. */
export type FixedObstacle = {
  type: "rect" | "oval"
  center: { x: number; y: number }
  width: number
  height: number
  zLayers: number[]
  connectedTo: string[]
  ccwRotationDegrees?: number
}

export type FixedObstacleContext = {
  obstacles: readonly FixedObstacle[]
  traceClearance: number
  connMap?: ConnectivityMap
}
