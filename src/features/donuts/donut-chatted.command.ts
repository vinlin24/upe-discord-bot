import {
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import donutService, { DONUT_CHATTED_BUTTON_ID } from "./donut.service";

// Component-only handler: this "command" exists purely to subscribe to the
// donut check-in button. It is not registered as a slash command.
class DonutChattedCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutchatted")
    .setDescription("(internal) Handles donut chat check-in button presses.")
    .toJSON();

  public override readonly shouldRegister = false;

  public override readonly componentIds = [DONUT_CHATTED_BUTTON_ID];

  public override async execute(
    _interaction: ChatInputCommandInteraction,
  ): Promise<void> { }

  public override async onComponent(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    const result = await donutService.markChatted(interaction.channelId);

    if (result === "not_active") {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("This donut chat is no longer active.")
          .setDescription(
            "A new cycle has started, so this button can't mark " +
            "the old chat as complete anymore.",
          )
          .setColor(Colors.Red),
        ],
        ephemeral: true,
      });
      return;
    }

    if (result === "already_marked") {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("This donut chat was already marked complete.")
          .setColor(Colors.Blue),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle("This donut chat has been completed!")
        .setDescription(
          `:tada: Marked by ${userMention(interaction.user.id)}.`,
        )
        .setColor(Colors.Green),
      ],
    });
  }
}

export default new DonutChattedCommand();
