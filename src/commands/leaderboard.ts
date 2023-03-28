const Byte = require("../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
const mongoose = require("mongoose");
import type { IByte, IEvent } from "../schemas/byte";

function getEventPoints(
  attended: number,
  totalBytes: number,
  location: "campus" | "westwood" | "la"
): number {
  let distanceMap = new Map<string, number>([
    ["campus", 1],
    ["westwood", 1.25],
    ["la", 1.75],
  ]);

  return 100 * (attended / totalBytes) * distanceMap.get(location)!;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboards")
    .setDescription("Are ya winnin'?"),
  async execute(interaction: ChatInputCommandInteraction) {
    const all: Array<IByte> = await Byte.find({});

    interface leaderboardEntry {
      name: string;
      points: number;
    }

    let leaderboard: Array<leaderboardEntry> = [];

    all.forEach((byte) => {
      let entry = {} as leaderboardEntry;
      entry.name = byte.name;
      entry.points = byte.events.reduce(
        (sum, event) =>
          sum + getEventPoints(event.num_mems, byte.total_mems, event.location),
        0
      );
      leaderboard.push(entry);
    });

    leaderboard.sort((a, b) => b.points - a.points);

    console.log(leaderboard);

    await interaction.reply("received");
  },
};
