import { Events, type Interaction } from "discord.js";

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

    console.log(`[DISPATCH] ${command.id} by @${interaction.user.username}.`);
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
        return;
      }
    }

    if (!interaction.replied) {
      console.warn(
        `${command.logName} did not reply to interaction, ` +
        "falling back to a generic response.",
      );
      await interaction.reply({ content: EMOJI_THUMBS_UP, ephemeral: true });
    }
  }
}

export default new InteractionDispatchListener();
