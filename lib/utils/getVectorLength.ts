// Math.hypot is implementation-approximated and can differ by one ULP between
// platforms. Use the same scaled arithmetic and correctly rounded square root
// for geometry decisions. Scaling avoids overflowing/underflowing the squares.
export const getVectorLength = (x: number, y: number): number => {
  const scale = Math.max(Math.abs(x), Math.abs(y))
  if (scale === 0 || scale === Number.POSITIVE_INFINITY) return scale
  const normalizedX = x / scale
  const normalizedY = y / scale
  return scale * Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY)
}
