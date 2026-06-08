/**
 * CSS `grid-template-columns` value for the camera/recordings grids.
 *
 * With no explicit column count we auto-fit tiles at a sensible minimum width,
 * so the card fills whatever container width it's given (a narrow ~490px
 * sections column on desktop, or a full-width view) without ever producing
 * tiny tiles. `min(100%, 180px)` keeps a single tile from overflowing very
 * narrow phones. An explicit `columns` value forces that fixed count.
 */
export function gridTemplate(columns?: number): string {
  if (columns && columns > 0) return `repeat(${columns}, 1fr)`;
  return "repeat(auto-fill, minmax(min(100%, 180px), 1fr))";
}
