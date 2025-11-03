import {
  EmbedBuilder,
  GuildMember,
  Role,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type ColorResolvable,
  type User,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";

export class SoftMentionCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("mention")
    .setDescription("Send a mention wrapped in an embed (a \"soft ping\").")
    .addMentionableOption(input => input
      .setName("mentionable")
      .setDescription("The entity to mention.")
      .setRequired(true),
    )
    .addStringOption(input => input
      .setName("message")
      .setDescription("Optional message to go in the same embed."),
    )
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const mentionable = interaction.options.getMentionable(
      "mentionable",
      true,
    ) as GuildMember | User | Role;
    const text = interaction.options.getString("message");

    const mention = mentionable instanceof Role
      ? roleMention(mentionable.id)
      : userMention(mentionable.id);

    let description = mention;
    if (text) {
      description += `\n${text}`;
    }

    let color: ColorResolvable | null = null;
    if (mentionable instanceof Role) {
      color = mentionable.color;
    }
    else if (mentionable instanceof GuildMember) {
      color = mentionable.displayColor;
    }

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(color);

    await interaction.reply({ embeds: [embed] });
  }
}

export default new SoftMentionCommand();
