import {
  channelMention,
  codeBlock,
  PermissionFlagsBits,
  PermissionsBitField,
  userMention,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type PermissionsString,
} from "discord.js";

import {
  SlashCommandCheck,
  type SlashCommandCheckDetails,
} from "../abc/check.abc";

type PermissionFlagsBit
  = typeof PermissionFlagsBits[keyof typeof PermissionFlagsBits];

type Payload = SlashCommandCheckDetails<{
  missingPermissions: PermissionsString[];
}>;

export class BotPermissionCheck extends SlashCommandCheck<Payload> {
  private readonly permissionsToCheck: PermissionFlagsBit[] = [];

  public override predicate(
    interaction: ChatInputCommandInteraction,
  ) {
    const { user: bot } = interaction.client;
    const channel = interaction.channel as GuildTextBasedChannel;
    const guild = interaction.guild as Guild;
    const botMember = guild.members.cache.get(bot.id)!;

    const effectivePermissions = botMember.permissionsIn(channel);
    const neededPermissions = this.getNeededBitField();

    const missingPermissions = effectivePermissions.missing(neededPermissions);
    if (missingPermissions.length === 0) {
      return { pass: true, missingPermissions: [] };
    }
    return { pass: false, missingPermissions };
  }

  public override async onFail(
    details: Payload & { pass: false },
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { missingPermissions } = details;
    const member = interaction.member as GuildMember;
    const channel = interaction.channel as GuildTextBasedChannel;

    console.log(
      `[CHECK] ${this.handler.id} blocked for ${member.user.username}: ` +
      `missing permissions: ${missingPermissions.join(", ")}`,
    );

    const neededPermissionNames = this.getNeededBitField().toArray();
    const diffBlock = codeBlock("diff", (
      `+ Requires: ${neededPermissionNames.join(", ")}\n` +
      `-  Missing: ${missingPermissions.join(", ")}`
    ));

    const content = (
      `${userMention(member.id)}, I am missing permissions in ` +
      `${channelMention(channel.id)} to execute this command:\n${diffBlock}`
    )
    await this.safeReply(interaction, { content, ephemeral: true });
  }

  public needsToHave(permission: PermissionFlagsBit): this {
    this.permissionsToCheck.push(permission);
    return this;
  }

  private getNeededBitField(): PermissionsBitField {
    return new PermissionsBitField(this.permissionsToCheck);
  }
}
