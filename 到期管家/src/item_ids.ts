/** Keep legacy duplicate suffixes while bringing every manual ID back under the storage/import limit. */
export function normalizeManualItemID(value: string): string {
  if (value.length <= 160) return value
  const ending = /-duplicate-\d+$/.exec(value)?.[0]
  return ending && ending.length < 160
    ? `${value.slice(0, 160 - ending.length)}${ending}`
    : value.slice(0, 160)
}
