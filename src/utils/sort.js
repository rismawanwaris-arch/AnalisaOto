/**
 * Compares two cell values safely with consistent handling of empty values, numbers, booleans, and strings.
 * Empty values (null, undefined, '') always sort to the end regardless of direction.
 */
export function compareValues(a, b, dir = 'asc') {
  const isEmptyA = a === null || a === undefined || a === '';
  const isEmptyB = b === null || b === undefined || b === '';
  if (isEmptyA && isEmptyB) return 0;
  if (isEmptyA) return 1;
  if (isEmptyB) return -1;

  let cmp = 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    cmp = (a ? 1 : 0) - (b ? 1 : 0);
  } else if (
    typeof a === 'number' &&
    typeof b === 'number' &&
    Number.isFinite(a) &&
    Number.isFinite(b)
  ) {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
  }

  return dir === 'desc' ? -cmp : cmp;
}

/**
 * Returns a new sorted shallow copy of `items` based on `sortConfig` ({ key, dir }) and optional `accessors`.
 */
export function sortArray(items = [], sortConfig, accessors = {}) {
  if (!Array.isArray(items)) return [];
  if (!sortConfig?.key) return [...items];
  const { key, dir = 'asc' } = sortConfig;
  const getter = accessors[key];

  return [...items].sort((itemA, itemB) => {
    const valA = getter ? getter(itemA) : itemA?.[key];
    const valB = getter ? getter(itemB) : itemB?.[key];
    return compareValues(valA, valB, dir);
  });
}

/**
 * Computes next sortConfig when clicking a column header.
 */
export function toggleSortConfig(prev, key, defaultDir = 'desc') {
  if (prev?.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: defaultDir };
}
