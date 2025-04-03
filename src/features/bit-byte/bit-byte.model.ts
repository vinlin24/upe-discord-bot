import mongoose from "mongoose";

import type {
  RoleId,
  UnixSeconds,
  UrlString
} from "../../types/branded.types";

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
  events: BitByteEvent[];
  jeopardyPoints: number;
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
  events: { type: [bitByteEventSchema], required: true },
  jeopardyPoints: { type: Number, required: true },
});

export const BitByteGroupModel = mongoose.model(
  "BitByteGroup",
  bitByteGroupSchema,
);
