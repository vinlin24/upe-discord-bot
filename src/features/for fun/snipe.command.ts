import {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    inlineCode,
    type ChatInputCommandInteraction,
    type Role,
  } from "discord.js";
  
  import { SlashCommandHandler } from "../../abc/command.abc";
  import {
    isMissingAccessError,
    isMissingPermissionsError,
  } from "../../utils/errors.utils";
  import {
    OFFICERS_ROLE_ID
  } from "../../utils/snowflakes.utils";
  class SnipeCommand extends SlashCommandHandler {
    public override readonly definition = new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Upload a snipe of ")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON();
  
    public override async execute(
      interaction: ChatInputCommandInteraction,
    ): Promise<void> {
      const { guild, channel } = interaction;
      if (!guild || !channel) {
        await interaction.reply(
          "⚠️ This command can only be used within a text channel.",
        );
        return;
      }
  
      if (!channel.isTextBased()) {
        await interaction.reply(
          "⚠️ This command can only be used in text channels.",
        );
        return;
      }
  
      const lastMessage = channel.messages.cache.last();
      if (!lastMessage) {
        await interaction.reply("⚠️ No messages to snipe.");
        return;
      }
  
      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription(lastMessage.content)
        .setFooter({ text: `Sent by ${lastMessage.author.tag}` })
        .setTimestamp(lastMessage.createdAt);
  
      await interaction.reply({ embeds: [embed] });
    }
  }
  export default new SnipeCommand();