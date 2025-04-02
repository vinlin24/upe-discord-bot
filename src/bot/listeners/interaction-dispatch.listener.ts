import {
  Events,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import { EMOJI_THUMBS_UP } from "../../utils/emojis.utils";
import { commandLoader } from "../loaders";

class InteractionDispatchListener extends
  DiscordEventListener<Events.InteractionCreate> {

  public override readonly event = Events.InteractionCreate;

  public override async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandLoader.get(interaction.commandName);
    if (command === null) {
      return;
    }

    try {
      await command.dispatch(interaction);
    }
    catch (error) {
      console.error("Uncaught error from command execution pipeline:");
      console.error(error);
      return await this.safeReply(
        interaction,
        "There was an error while executing this command!",
      );
    }

    console.warn(
      `${command.logName} did not reply to interaction, ` +
      "falling back to a generic response.",
    );
    await this.safeReply(interaction, EMOJI_THUMBS_UP);
  }

  private async safeReply(
    interaction: ChatInputCommandInteraction,
    content: string,
  ): Promise<void> {
    if (!interaction.replied) {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

export default new InteractionDispatchListener();
