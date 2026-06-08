/**
 * CSS `grid-template-columns` value for the camera/recordings grids.
 *
 * With no explicit column count we use `auto-fit` (not `auto-fill`): empty
 * tracks collapse so the real tiles stretch to fill the container width. In a
 * full-width panel a handful of cameras become one row of large tiles; in a
 * narrow ~490px sections column they wrap to 2-up. `min(100%, 220px)` keeps a
 * single tile from overflowing very narrow phones. An explicit `columns` value
 * forces that fixed count (tiles still stretch via 1fr).
 */
export function gridTemplate(columns?: number): string {
  if (columns && columns > 0) return `repeat(${columns}, 1fr)`;
  return "repeat(auto-fit, minmax(min(100%, 220px), 1fr))";
}
