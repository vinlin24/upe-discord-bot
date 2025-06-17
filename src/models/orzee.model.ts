import mongoose from "mongoose";

import type { UnixSeconds, UserId } from "../types/branded.types";

export type Orzee = {
  userId: UserId;
  chosen: UnixSeconds;
};

const orzeeSchema = new mongoose.Schema<Orzee>({
  userId: { type: String, required: true, unique: true },
  chosen: { type: Number },
});

// TODO: At the moment, this shares the same database with the induction stuff,
// which is seasonal. We should have a way to separate seasonal stuff from
// general stuff.
export const OrzeeModel = mongoose.model(
  "OrzeeSet",
  orzeeSchema,
);
