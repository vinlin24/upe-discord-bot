import {
  AttachmentBuilder,
  BaseInteraction,
  Collection,
  EmbedBuilder,
  MessageComponentInteraction,
} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { eventPages } from "./event-pages";
import { getEventPoints } from "./functions/get-points";
import type { IByte, IEvent } from "./schemas/byte";
const { Client, GatewayIntentBits } = require("discord.js");
const { token, connectionString } = require("../config.json");
const { connect, mongoose } = require("mongoose");
const Byte = require("./schemas/byte");

console.log("Bot is starting...");

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.commands = new Collection();
client.selectMenus = new Collection();
client.buttons = new Collection();

const cmdFoldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(cmdFoldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(cmdFoldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".ts"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

client.selectMenus.set();

// When the client is ready, run this code (only once)
client.once("ready", () => {
  console.log("Ready!");
});

client.on("interactionCreate", async (interaction: BaseInteraction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (interaction === null) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

client.on(
  "interactionCreate",
  async (interaction: MessageComponentInteraction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === "byteselector") {
      console.log(interaction.values[0].toString());

      const selected: IByte = await Byte.findById(interaction.values[0]);
      const events: Array<IEvent> = selected.events;
      const images: AttachmentBuilder[] = [];

      let pages: Array<EmbedBuilder> = events.map((entry) => {
        const imagePath = path.join(__dirname, "..", "event-pics", entry.pic);
        const file = new AttachmentBuilder(imagePath);
        images.push(file);

        return new EmbedBuilder()
          .setTitle(entry.location === "Jeopardy" ? "Jeopardy" : entry.caption)
          .setImage(`attachment://${entry.pic}`)
          .addFields({
            name: "Points Earned",
            value: `${getEventPoints(entry, selected.total_mems)}`,
          }, { name: "Date", value: entry.date.toLocaleDateString() });
      });

      eventPages(interaction, pages, images);
    }
  }
);

// Login to Discord with your client's token
client.login(token);
(async () => {
  connect(connectionString).catch(console.error);
})();
