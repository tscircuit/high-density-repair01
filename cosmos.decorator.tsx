import type { ReactNode } from "react"

export default ({ children }: { children: ReactNode }) => (
  <div style={{ width: "100vw", height: "100vh" }}>{children}</div>
)
