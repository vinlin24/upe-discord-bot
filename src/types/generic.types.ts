// Typescript-related utilities.

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
