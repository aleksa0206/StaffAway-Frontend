const PALETTE_SIZE = 8;

/**
 * Stable colour for a leave type (CSS variable from the tokens). Always shown together with the
 * type's name, never as the only way to tell types apart.
 */
export function leaveTypeColor(leaveTypeId: number): string {
  return `var(--leave-${(leaveTypeId % PALETTE_SIZE) + 1})`;
}
