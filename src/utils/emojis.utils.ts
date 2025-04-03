import type { Branded } from "../types/branded.types";

export type BuiltinEmoji = Branded<`:${string}:`, "BuiltinEmoji">;

export const EMOJI_THUMBS_UP
  = ":thumbsup:" as BuiltinEmoji;
export const EMOJI_RAISED_EYEBROW
  = ":face_with_raised_eyebrow:" as BuiltinEmoji;
