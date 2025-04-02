declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
/**
 * Create a branded type.
 *
 * Ref: https://egghead.io/blog/using-branded-types-in-typescript.
 */
export type Branded<T, B> = T & Brand<B>;

/** Represents a filesystem path. */
export type Path = Branded<string, "Path">;
