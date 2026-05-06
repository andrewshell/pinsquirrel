/**
 * Recursively converts a domain type to its JSON wire-format equivalent.
 *
 * `JSON.stringify` produces ISO 8601 strings for Date values; this type
 * mirrors that conversion so wire-format schemas (e.g. OpenAPI response
 * schemas) can be compile-time anchored to their domain counterparts.
 */
export type Jsonify<T> = T extends Date
  ? string
  : T extends null
    ? null
    : T extends undefined
      ? undefined
      : T extends Array<infer U>
        ? Array<Jsonify<U>>
        : T extends object
          ? { [K in keyof T]: Jsonify<T[K]> }
          : T
