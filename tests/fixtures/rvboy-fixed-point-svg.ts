import fixture from "./rvboy-plated-hole-fixed-points.json"

export function renderRvboyFixedPointSvg(point: {
  x: number
  y: number
}): string {
  const node = fixture.nodeWithPortPoints[0]
  const bottom = node.center.y - node.height / 2
  const original = fixture.hdRoutes[0].route[0]
  // Identical world-coordinate crops. The y axis is enlarged so a 10.8 nm
  // boundary violation remains visible; these are routing envelopes, not pads.
  // Translate the crop origin and scale mm to nm before rendering to avoid
  // losing the small delta in SVG renderers that use float32 transforms.
  const panels = [original, point].map((p, i) => {
    const valid = p.y >= bottom - 1e-6
    const color = valid ? "#15803d" : "#b91c1c"
    return `<g transform="translate(${20 + i * 460},0)">
      <text x="0" y="32" font-size="20">${i === 0 ? "Input fixed anchor" : "Optimizer output"}</text>
      <svg x="0" y="55" width="420" height="260"
        viewBox="0 0 600 60" preserveAspectRatio="none">
        <rect x="0" y="0" width="600" height="${(27.70004 - bottom) * 1e6}" fill="#dcfce7"/>
        <path d="M0 ${(27.70004 - bottom) * 1e6} H600" stroke="#334155" stroke-width="0.3"/>
        <path d="M${(p.x - 23.48695) * 1e6} ${(27.70004 - p.y) * 1e6} L${(node.center.x - 23.48695) * 1e6} ${(27.70004 - node.center.y) * 1e6}" stroke="${color}" stroke-width="0.3"/>
        <ellipse cx="${(p.x - 23.48695) * 1e6}" cy="${(27.70004 - p.y) * 1e6}" rx="6" ry="1.4" fill="${color}"/>
      </svg>
      <text x="0" y="340" font-size="16">x = ${p.x} mm; y = ${p.y} mm</text>
      <text x="0" y="366" font-size="16" fill="${color}">${valid ? "On routing boundary: layer connection retained" : "Outside routing boundary: layer connection lost"}</text>
    </g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="940" height="440" viewBox="0 0 940 440">
    <rect width="940" height="440" fill="white"/>
    <g font-family="sans-serif" fill="#0f172a">${panels.join("")}
      <text x="20" y="407" font-size="15">RVboy cmn_1981 / pcb_plated_hole_10 · routing boundary y = ${bottom} mm</text>
      <text x="20" y="428" font-size="14">Exact sample coordinates; y scale enlarged. Green area is the plated-hole routing envelope.</text>
    </g>
  </svg>`
}
