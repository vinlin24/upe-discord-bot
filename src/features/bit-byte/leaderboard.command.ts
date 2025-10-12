import {
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import _ from "lodash";

import { SlashCommandHandler } from "../../abc/command.abc";
import bitByteService from "../../services/bit-byte.service";
import type { RoleId } from "../../types/branded.types";
import {
  EMOJI_EIGHT,
  EMOJI_FIRST_PLACE,
  EMOJI_FIVE,
  EMOJI_FOUR,
  EMOJI_NINE,
  EMOJI_SECOND_PLACE,
  EMOJI_SEVEN,
  EMOJI_SIX,
  EMOJI_TEN,
  EMOJI_THIRD_PLACE,
} from "../../utils/emojis.utils";

type LeaderboardEntry = {
  roleId: RoleId;
  points: number;
};

/** @deprecated As of F25, bit-byte no longer has a leaderboard/prize system. */
class LeaderboardCommand extends SlashCommandHandler {
  public override readonly shouldRegister = false;

  public override readonly definition = new SlashCommandBuilder()
    .setName("leaderboardbitbyte")
    .setDescription("Are ya winnin'?")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const leaderboard = await this.calculateLeaderboard();
    await interaction.reply({ embeds: [this.formatLeaderboard(leaderboard)] });
  }

  private async calculateLeaderboard(): Promise<LeaderboardEntry[]> {
    const leaderboard: LeaderboardEntry[] = [];

    const groups = await bitByteService.getAllActiveGroups();

    for (const [roleId, group] of groups) {
      const eventPoints = bitByteService.calculateBitByteGroupPoints(group);
      const totalPoints = eventPoints + group.jeopardyPoints;
      leaderboard.push({ roleId, points: totalPoints });
    }

    // Sort DESCENDING by points.
    leaderboard.sort((lhs, rhs) => rhs.points - lhs.points);
    return leaderboard;
  }

  private formatLeaderboard(leaderboard: LeaderboardEntry[]): EmbedBuilder {
    const placeColumn = _.range(1, leaderboard.length + 1)
      .map(place => this.getEmojiForPlace(place))
      .join("\n");

    const mentionColumn = leaderboard
      .map(group => roleMention(group.roleId))
      .join("\n");

    const pointsColumn = leaderboard
      .map(group => group.points)
      .join("\n");

    return new EmbedBuilder()
      .setTitle("Bit-Byte Leaderboard")
      .addFields(
        { name: "Place", value: placeColumn, inline: true },
        { name: "Group", value: mentionColumn, inline: true },
        { name: "Points", value: pointsColumn, inline: true },
      );
  }

  private getEmojiForPlace(place: number): string {
    switch (place) {
      case 1:
        return EMOJI_FIRST_PLACE;
      case 2:
        return EMOJI_SECOND_PLACE;
      case 3:
        return EMOJI_THIRD_PLACE;
      case 4:
        return EMOJI_FOUR;
      case 5:
        return EMOJI_FIVE;
      case 6:
        return EMOJI_SIX;
      case 7:
        return EMOJI_SEVEN;
      case 8:
        return EMOJI_EIGHT;
      case 9:
        return EMOJI_NINE;
      case 10:
        return EMOJI_TEN;
      default:
        return inlineCode(place.toString());
    }
  }
}

export default new LeaderboardCommand();
