import mongoose from "mongoose";

import type {
  ChannelId,
  RoleId,
  UnixSeconds,
  UrlString,
} from "../types/branded.types";

export enum BitByteLocation {
  OnCampus = "On-campus",
  Westwood = "Westwood",
  LA = "LA",
}

export type BitByteEvent = {
  location: BitByteLocation;
  caption: string;
  picture: UrlString;
  numAttended: number;
  numTotal: number;
  timestamp: UnixSeconds;
};

export type BitByteGroup = {
  roleId: RoleId;
  channelId: ChannelId;
  events: BitByteEvent[];
  jeopardyPoints: number;
  deleted: boolean;
};

const bitByteEventSchema = new mongoose.Schema<BitByteEvent>({
  location: {
    type: String,
    enum: Object.values(BitByteLocation),
    required: true,
  },
  caption: { type: String, required: true },
  picture: { type: String, required: true },
  numAttended: { type: Number, required: true },
  numTotal: { type: Number, required: true },
  timestamp: { type: Number, required: true },
});

const bitByteGroupSchema = new mongoose.Schema<BitByteGroup>({
  roleId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  events: { type: [bitByteEventSchema], default: [] },
  jeopardyPoints: { type: Number, default: 0 },
  deleted: { type: Boolean, default: false },
});

export const BitByteGroupModel = mongoose.model(
  "BitByteGroup",
  bitByteGroupSchema,
);
