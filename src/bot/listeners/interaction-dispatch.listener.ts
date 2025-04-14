import {
  ChannelType,
  Events,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type MessageComponentInteraction,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import { EMOJI_THUMBS_UP } from "../../utils/emojis.utils";
import { commandLoader } from "../loaders";

class InteractionDispatchListener extends
  DiscordEventListener<Events.InteractionCreate> {

  public override readonly event = Events.InteractionCreate;

  public override async execute(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
      return await this.handleChatInputCommandInteraction(interaction);
    }
    if (interaction.isAutocomplete()) {
      return await this.handleAutocompleteInteraction(interaction);
    }
    if (interaction.isMessageComponent()) {
      return await this.handleMessageComponentInteraction(interaction);
    }
  }

  private async handleChatInputCommandInteraction(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { commandName, channel, user: caller } = interaction;

    const command = commandLoader.get(commandName);
    if (command === null) {
      return;
    }

    // Commands should only be used in text channels within the server (no DMs).
    if (channel?.type !== ChannelType.GuildText) {
      console.error(
        "[DISPATCH] Invalid channel type: " +
        `${channel && ChannelType[channel.type]}`,
      );
      return;
    }

    console.log(
      `[DISPATCH] ${command.id} by @${caller.username} in #${channel.name}`,
    );
    try {
      await command.dispatch(interaction);
    }
    catch (error) {
      console.error("[DISPATCH] Uncaught error in command execution pipeline:");
      console.error(error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
      else {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
      return;
    }

    if (!interaction.replied) {
      console.warn(
        `${command.logName} did not reply to interaction, ` +
        "falling back to a generic response.",
      );
      await interaction.reply({ content: EMOJI_THUMBS_UP, ephemeral: true });
    }
  }

  private async handleAutocompleteInteraction(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    const handler = commandLoader.get(interaction.commandName);
    if (handler === null) {
      return;
    }
    try {
      await handler.dispatchAutocomplete(interaction);
    }
    catch (error) {
      console.error(
        "[DISPATCH Uncaught error in autocomplete execution pipeline:",
      )
      console.error(error);
    }
  }

  private async handleMessageComponentInteraction(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    const handler = commandLoader.getSubscribedHandler(interaction.customId);
    if (handler === null) {
      return;
    }
    try {
      await handler.dispatchComponent(interaction);
    }
    catch (error) {
      console.error(
        "[DISPATCH] Uncaught error in component event execution pipeline:"
      );
      console.error(error);
    }
  }
}

export default new InteractionDispatchListener();
