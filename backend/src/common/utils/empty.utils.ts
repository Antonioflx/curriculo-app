type Sizable = string | readonly unknown[] | ReadonlySet<unknown> | ReadonlyMap<unknown, unknown>;

/** `true` para `null`, `undefined`, string, array, Set ou Map sem elementos. */
export function isEmpty(value: Sizable | null | undefined): boolean {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  return (value as ReadonlySet<unknown> | ReadonlyMap<unknown, unknown>).size === 0;
}

/** Inverso de `isEmpty`; também estreita o tipo para fora de `null`/`undefined`. */
export function isNotEmpty<T extends Sizable>(value: T | null | undefined): value is T {
  return !isEmpty(value);
}
