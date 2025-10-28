import type { Message } from "discord.js";
import type { Branded } from "../types/branded.types";

export type BuiltinEmoji = Branded<`:${string}:`, "BuiltinEmoji">;

export const EMOJI_THUMBS_UP
  = ":thumbsup:" as BuiltinEmoji;
export const EMOJI_RAISED_EYEBROW
  = ":face_with_raised_eyebrow:" as BuiltinEmoji;
export const EMOJI_FEARFUL
  = ":fearful:" as BuiltinEmoji;
export const EMOJI_THINKING
  = ":thinking:" as BuiltinEmoji;
export const EMOJI_SALUTE
  = ":saluting_face:" as BuiltinEmoji;

export const EMOJI_CHECK = ":white_check_mark:" as BuiltinEmoji;
export const EMOJI_CROSS = ":x:" as BuiltinEmoji;
export const EMOJI_IN_PROGRESS = ":arrows_counterclockwise:" as BuiltinEmoji;

export const EMOJI_WARNING = ":warning:" as BuiltinEmoji;
export const EMOJI_ALERT = ":rotating_light:" as BuiltinEmoji;
export const EMOJI_INFORMATION = ":information_source:" as BuiltinEmoji;
export const EMOJI_ANNOUNCEMENT = ":mega:" as BuiltinEmoji;
export const EMOJI_WIP = ":construction:" as BuiltinEmoji;

export const EMOJI_CLOCK = ":watch:" as BuiltinEmoji;
export const EMOJI_GRADUATION = ":mortar_board:" as BuiltinEmoji;

export const EMOJI_ONE = ":one:" as BuiltinEmoji;
export const EMOJI_TWO = ":two:" as BuiltinEmoji;
export const EMOJI_THREE = ":three:" as BuiltinEmoji;
export const EMOJI_FOUR = ":four:" as BuiltinEmoji;
export const EMOJI_FIVE = ":five:" as BuiltinEmoji;
export const EMOJI_SIX = ":six:" as BuiltinEmoji;
export const EMOJI_SEVEN = ":seven:" as BuiltinEmoji;
export const EMOJI_EIGHT = ":eight:" as BuiltinEmoji;
export const EMOJI_NINE = ":nine:" as BuiltinEmoji;
export const EMOJI_TEN = ":keycap_ten:" as BuiltinEmoji;

export const EMOJI_FIRST_PLACE = ":first_place:" as BuiltinEmoji;
export const EMOJI_SECOND_PLACE = ":second_place:" as BuiltinEmoji;
export const EMOJI_THIRD_PLACE = ":third_place:" as BuiltinEmoji;
export const EMOJI_MEDAL = ":medal:" as BuiltinEmoji;

// NOTE: We distinguish reaction emojis from "built-in emojis" because we need
// to pass in the actual Unicode emoji string to reaction APIs instead of the
// colon form.
export type UnicodeReactionEmoji = Branded<string, "RawReactionEmoji">;

export enum LetterReactionEmoji {
  // TODO: Add all letters and also make an enum for numbers.
  O = "🇴",
  R = "🇷",
  Z = "🇿",
}

export type ReactionEmoji = UnicodeReactionEmoji | LetterReactionEmoji;

export const REACTION_BOT_ERROR = "😵" as UnicodeReactionEmoji;
export const REACTION_UNKNOWN_TEXT_COMMAND = "❓" as UnicodeReactionEmoji;
export const REACTION_UNAUTHORIZED_TEXT_COMMAND = "⛔" as UnicodeReactionEmoji;
export const REACTION_SIX = "6️⃣" as UnicodeReactionEmoji;
export const REACTION_SEVEN = "7️⃣" as UnicodeReactionEmoji;
export const REACTION_SHRUG = "🤷" as UnicodeReactionEmoji;

export async function reactString(
  message: Message,
  sequence: string,
): Promise<void> {
  for (const character of sequence.toUpperCase()) {
    const reactionEmoji = LetterReactionEmoji[
      character as keyof typeof LetterReactionEmoji
    ];
    if (reactionEmoji === undefined) {
      console.warn(`invalid letter to try and react with: ${character}`);
    }
    else {
      await message.react(reactionEmoji);
    }
  }
}
