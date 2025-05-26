// Because TypeScript enums are notoriously frustrating to deal with sometimes.

/** Courtesy of ChatGPT. */
export function getNumericEnumValues<
  TEnum extends Record<string, string | number>
>(enumObj: TEnum): Array<TEnum[keyof TEnum]> {
  return Object.values(enumObj).filter(
    v => typeof v === "number"
  ) as Array<TEnum[keyof TEnum]>;
}
