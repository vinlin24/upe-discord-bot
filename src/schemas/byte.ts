const { Schema, model } = require("mongoose");

const byteSchema = new Schema({
  _id: Schema.Types.ObjectId,
  name: String,
  byte_ids: [String],
  events: [
    {
      location: String,
      num_mems: Number,
      pic: String,
      caption: String,
    },
  ],
  total_mems: Number,
});

module.exports = model("Byte", byteSchema);
