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

export type SeasonId = Branded<`${"F" | "S"}${number}`, "SeasonId">;
