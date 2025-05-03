// Typescript-related utilities.

import assert from "node:assert";

/**
 * String enums do not have reverse mappings generated for them, so we need to
 * manually iterate over the keys to retrieve an enum member from string value.
 *
 * Ref: https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings
 *
 * Thanks ChatGPT.
 */
export function getEnumFromName<StringEnum extends Record<string, string>>(
  enumObj: StringEnum,
  value: string,
): StringEnum[keyof StringEnum] | undefined {
  const allKeys = Object.keys(enumObj) as Array<keyof StringEnum>;
  const reverseMappedKey = allKeys.find(key => enumObj[key] === value);
  return reverseMappedKey === undefined ? undefined : enumObj[reverseMappedKey];
}

/**
 * Generalization of the pattern of defining a `type` from a `const` array.
 *
 * Thanks ChatGPT.
 */
export type ArrayToUnion<T extends readonly any[]>
  = T extends readonly (infer U)[] ? U : never;

/** Narrow the type of an array if it has at least one element. */
export function isNonEmptyArray<T>(array: T[]): array is [T, ...T[]] {
  return array.length > 0;
}

/** Assert that an array has at least one element. */
export function assertNonEmptyArray<T>(
  array: T[],
): asserts array is [T, ...T[]] {
  assert(array.length > 0);
}

export type Mutable<T extends readonly unknown[]> = [...T];

export function asMutable<T extends readonly unknown[]>(array: T): Mutable<T> {
  return array as Mutable<T>;
}
