import type { Snowflake } from "discord.js";

declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
/**
 * Create a branded type.
 *
 * Ref: https://egghead.io/blog/using-branded-types-in-typescript.
 */
export type Branded<T, B> = T & Brand<B>;

/** Extract the brand tag of a branded type. */
export type BrandOf<T> = T extends Brand<infer Tag> ? Tag : never;

/**
 * Convenience function for asserting that `value` is some `number`-derived
 * branded type. Note that no check is done besides just checking that `value`
 * is a `number`, so this is as type-safe as blindly asserting `as BrandedType`
 * to an expression. Use with care.
 */
export function isBrandedNumber<T extends number>(
  value: unknown,
): value is T {
  return typeof value === "number";
}

/**
 * Convenience function for casting `value` to some `number`-derived branded
 * type.
 */
export function asBrandedNumber<T extends number>(
  value: unknown,
): T {
  return value as T;
}

/** Represents a filesystem path. */
export type Path = Branded<string, "Path">;

/** Represents a URL. */
export type UrlString = Branded<string, "UrlString">;

/** Represents a Unix timestamp, in seconds. */
export type UnixSeconds = Branded<number, "UnixSeconds">;

/** Represents a time duration, in seconds. */
export type Seconds = Branded<number, "Seconds">;

/** Represents a time duration, in milliseconds. */
export type Milliseconds = Branded<number, "Milliseconds">;

// Discord Snowflakes.

export type GuildId = Branded<Snowflake, "GuildId">;
export type ChannelId = Branded<Snowflake, "ChannelId">;
export type RoleId = Branded<Snowflake, "RoleId">;
export type UserId = Branded<Snowflake, "UserId">;
export type CommandId = Branded<Snowflake, "CommandId">;

export type SeasonId = Branded<`${"F" | "S"}${number}`, "SeasonId">;

export type Quarter = "Fall" | "Winter" | "Spring";
export type QuarterName = Branded<`${Quarter} ${number}`, "QuarterName">;
