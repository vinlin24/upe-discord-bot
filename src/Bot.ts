import { BaseInteraction, Collection, SlashCommandBuilder } from "discord.js";

const fs = require("node:fs");
const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");
const { token, connectionString } = require("../config.json");
const { connect } = require('mongoose');

console.log("Bot is starting...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file: string) => file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Set a new item in the Collection
  // With the key as the command name and the value as the exported module
  client.commands.set(command.data.name, command);
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

// Login to Discord with your client's token
client.login(token);
(async () => {
  connect(connectionString).catch(console.error);
})();