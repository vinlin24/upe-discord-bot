import { InducteeStatus } from "../../services/inductee-sheets.service";
import {
  type BuiltinEmoji,
  EMOJI_CHECK,
  EMOJI_CLOCK,
  EMOJI_WARNING,
} from "../../utils/emojis.utils";

export function formatInducteeStatusText(status: InducteeStatus): string {
  let emoji: BuiltinEmoji;
  switch (status) {
    case InducteeStatus.Active:
      emoji = EMOJI_CHECK;
      break;
    case InducteeStatus.Dropped:
      emoji = EMOJI_WARNING;
      break;
    case InducteeStatus.Deferred:
      emoji = EMOJI_CLOCK;
      break;
  }
  return `${status.toUpperCase()} ${emoji}`;
}
