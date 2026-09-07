/** Page number from the URL; anything that is not a positive integer is treated as page 1. */
export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((option) => option === value);
}
