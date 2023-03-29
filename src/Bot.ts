import { BaseInteraction, Collection, MessageComponentInteraction } from "discord.js";

import * as fs from 'fs';
import * as path from 'path';
const { Client, GatewayIntentBits } = require("discord.js");
const { token, connectionString } = require("../config.json");
const { connect } = require('mongoose');

console.log("Bot is starting...");

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// When the client is ready, run this code (only once)
client.once("ready", () => {
  console.log("Ready!");
});

client.on("interactionCreate", async (interaction: BaseInteraction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(client.commands);

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

client.on("interactionCreate", async (interaction: MessageComponentInteraction) => {
	if (!interaction.isStringSelectMenu()) return;

  const { selectMenus } = client;
  const { customId } = interaction;

	if (interaction.customId === 'select') {
		await interaction.update({ content: 'Something was selected!', embeds: [], components: [] });
	}
});

// Login to Discord with your client's token
client.login(token);
(async () => {
  connect(connectionString).catch(console.error);
})();