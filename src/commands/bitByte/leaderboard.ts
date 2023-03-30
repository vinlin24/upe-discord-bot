const Byte = require("../../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
const mongoose = require("mongoose");
import type { IByte, IEvent } from "../../schemas/byte";
import { getEventPoints } from "../../functions/get-points"


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
          sum + getEventPoints(event, byte.total_mems),
        0
      );
      leaderboard.push(entry);
    });

    leaderboard.sort((a, b) => b.points - a.points);

    function generatePlaceRows(len: number) : string {
      let output : string = ""
      for (let i = 0; i < len; i++) {
        switch(i+1) {
          case 1:
            output += ":first_place:\n";
            break;
          case 2:
            output += ":second_place:\n";
            break;
          case 3:
            output += ":third_place:\n";
            break;   
          case 4:
            output += ":four:\n"
            break;
          case 5:
            output += ":five:\n"
            break;
          case 6:
            output += ":six:\n";
            break;
          case 7:
            output += ":seven:\n";
            break;
          case 8:
            output += ":eight:\n";
            break;   
          case 9:
            output += ":nine:\n"
            break;
          case 10:
            output += ":ten:\n"
            break;
          default: 
            output += `\`${i+1}\`\n`
        }
      }
      return output
    }

    const leaderboardEmbed = new EmbedBuilder()
      .setTitle('Bit-Byte Leaderboards')
      .addFields(
        {name: "Place", value: generatePlaceRows(leaderboard.length), inline: true},
        {name: "Byte", value: leaderboard.reduce((output, row) => output + row.name + "\n", "" ), inline: true},
        {name: "Points", value: leaderboard.reduce((output, row) => output + row.points + "\n", "" ), inline: true}
      )

    await interaction.reply({embeds: [leaderboardEmbed], ephemeral: false})

  },
};
