import type { Branded } from "../types/branded.types";

export type BuiltinEmoji = Branded<`:${string}:`, "BuiltinEmoji">;

export const EMOJI_THUMBS_UP = ":thumbsup:" as BuiltinEmoji;
