import {
  EmbedBuilder,
  GuildMember,
  type ChatInputCommandInteraction,
  type ImageURLOptions,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";

export class PfpCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("pfp")
    .setDescription("Get the profile picture image of a user.")
    .addUserOption(input => input
      .setName("member")
      .setDescription("User whose profile picture to get.")
      .setRequired(true),
    )
    .addBooleanOption(input => input
      .setName("force_user_profile")
      .setDescription(
        "Directly get user profile avatar " +
        "(not server-specific avatar, if set).",
      ),
    )
    .addEphemeralOption()
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { options } = interaction;
    const member = options.getMember("member");
    const useUserProfile = options.getBoolean("force_user_profile") ?? false;
    const ephemeral = options.getBoolean("ephemeral") ?? false;

    if (!(member instanceof GuildMember)) {
      await this.replyError(interaction, (
        "That doesn't seem to be a valid server member!"
      ));
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`@${member.user.username} Profile Picture`)
      .setColor(member.roles.highest.color);

    if (useUserProfile) {
      this.getUserWidePfp(member, embed);
    }
    else {
      const hasServerAvatar = this.getServerPfp(member, embed);
      if (!hasServerAvatar) {
        this.getUserWidePfp(member, embed);
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral });
  }

  // TODO: Could make these customizable options.
  private static readonly IMAGE_OPTIONS = {
    extension: "png",
    size: 4096,
  } as const satisfies ImageURLOptions;

  private getUserWidePfp(member: GuildMember, embed: EmbedBuilder): boolean {
    const userAvatar = member.user.avatarURL(PfpCommand.IMAGE_OPTIONS);
    if (userAvatar === null) {
      embed.setDescription("This user doesn't have a profile picture!");
      embed.setImage(null);
      return false;
    }
    embed.setDescription(null);
    embed.setImage(userAvatar);
    return true;
  }

  private getServerPfp(member: GuildMember, embed: EmbedBuilder): boolean {
    const memberAvatar = member.avatarURL(PfpCommand.IMAGE_OPTIONS);
    if (memberAvatar === null) {
      embed.setDescription("This user doesn't have a server profile picture!");
      embed.setImage(null);
      return false;
    }
    embed.setDescription(null);
    embed.setImage(memberAvatar);
    return true;
  }
}

export default new PfpCommand();
