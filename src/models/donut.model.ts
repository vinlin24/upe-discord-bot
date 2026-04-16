import mongoose from "mongoose";

import type { ChannelId, GuildId, UserId } from "../types/branded.types";

export type DonutState = {
  guildId: GuildId;
  channelId: ChannelId | null;
  users: UserId[];
  timezone: string | null;
  nextChat: string | null;
  threads: string[];
  completed: string[];
  history: UserId[][][];
  paused: boolean;
};

const donutStateSchema = new mongoose.Schema<DonutState>({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: null },
  users: { type: [String], default: [] },
  timezone: { type: String, default: null },
  nextChat: { type: String, default: null },
  threads: { type: [String], default: [] },
  completed: { type: [String], default: [] },
  history: { type: mongoose.Schema.Types.Mixed, default: [] },
  paused: { type: Boolean, default: false },
});

export const DonutStateModel = mongoose.model(
  "DonutState",
  donutStateSchema,
);
