import mongoose from "mongoose";

import type { GuildId, UserId } from "../types/branded.types";

export type DonutState = {
  guildId: GuildId;
  users: UserId[];
  nextChatIsoTime: string | null;
  history: UserId[][][];
  paused: boolean;
};

const donutStateSchema = new mongoose.Schema<DonutState>({
  guildId: { type: String, required: true, unique: true },
  users: { type: [String], default: [] },
  nextChatIsoTime: { type: String, default: null },
  history: { type: mongoose.Schema.Types.Mixed, default: [] },
  paused: { type: Boolean, default: false },
});

export const DonutStateModel = mongoose.model(
  "DonutState",
  donutStateSchema,
);
