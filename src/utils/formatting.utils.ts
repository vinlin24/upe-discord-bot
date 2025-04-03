import type {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
} from "discord.js";

export function toBulletedList(lines: unknown[]): string {
  return lines.map(line => `* ${line}`).join("\n");
}

export function formatContext(
  interaction: ChatInputCommandInteraction,
): string {
  const commandName = interaction.commandName;
  const callerName = interaction.user.username;
  const channelName = (interaction.channel as GuildTextBasedChannel).name;
  return `@${callerName} /${commandName} #${channelName}`;
}
