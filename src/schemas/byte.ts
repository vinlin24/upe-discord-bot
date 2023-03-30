import { Schema, Types, model } from "mongoose";

export interface IEvent {
  location: "campus" | "westwood" | "la" | "jeopardy";
  num_mems: number;
  pic: string;
  caption: string;
  date: Date;
}

export interface IByte {
  _id: Types.ObjectId;
  name: string;
  byte_ids: string[];
  events: IEvent[];
  total_mems: number;
}

const byteSchema = new Schema<IByte>({
  _id: Types.ObjectId,
  name: String,
  byte_ids: [String],
  events: Array<IEvent>,
  total_mems: Number,
});

module.exports = model<IByte>("Byte", byteSchema);
