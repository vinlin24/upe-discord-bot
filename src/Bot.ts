import { Client, ClientOptions } from "discord.js";
import ready from "./listeners/ready";
const auth = require('../auth.json');

console.log("Bot is starting...");

const client = new Client({
    intents: []
});

ready(client);

client.login(auth.token);