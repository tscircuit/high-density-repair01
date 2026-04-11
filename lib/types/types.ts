export type BoardLayer = "top" | "inner1" | "inner2" | "bottom"

export type ObstacleType = "oval" | "rect"

export type ZLayer = 0 | 1

export interface Point2D {
  x: number
  y: number
}

export interface Point3D extends Point2D {
  insideJumperPad?: boolean
  z: ZLayer
}

export interface AdjacentObstacle {
  center: Point2D
  connectedTo: string[]
  height: number
  layers: BoardLayer[]
  type: ObstacleType
  width: number
}

export interface ConnMap {
  idToNetMap: Record<string, string>
  netMap: Record<string, string[]>
}

export interface ViaRegion {
  center: Point2D
  connectedTo: string[]
  diameter: number
  viaRegionId: string
}

export interface NodeHdRoute {
  capacityMeshNodeId: string
  connectionName: string
  rootConnectionName: string
  route: Point3D[]
  traceThickness: number
  viaDiameter: number
  viaRegions?: ViaRegion[]
  vias: Point2D[]
}

export interface PortPoint extends Point3D {
  connectionName: string
  portPointId: string
  rootConnectionName: string
}

export interface NodeWithPortPoints {
  availableZ: ZLayer[]
  capacityMeshNodeId: string
  center: Point2D
  height: number
  portPoints: PortPoint[]
  width: number
}

export interface Sample {
  adjacentObstacles: AdjacentObstacle[]
  connMap: ConnMap
  nodeHdRoutes: NodeHdRoute[]
  nodeWithPortPoints: NodeWithPortPoints
}

export type HighDensityIntraNodeRoute = NodeHdRoute
export type HighDensityRepair01Input = Sample
