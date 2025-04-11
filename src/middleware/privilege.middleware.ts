import {
  codeBlock,
  GuildMember,
  PermissionFlagsBits,
  userMention,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  SlashCommandCheck,
  type SlashCommandCheckDetails,
} from "../abc/check.abc";
import {
  DEVELOPER_USER_ID,
  INDUCTEES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  MEMBERS_ROLE_ID,
  OFFICERS_ROLE_ID,
} from "../utils/snowflakes.utils";

export enum Privilege {
  None = 0,
  Inductee,
  Member,
  Officer,
  Induction,
  Administrator,
  Developer,
}

export function highestPrivilege(member: GuildMember): Privilege {
  if (member.id === DEVELOPER_USER_ID) {
    return Privilege.Developer;
  }
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return Privilege.Administrator;
  }
  if (member.roles.cache.has(INDUCTION_AND_MEMBERSHIP_ROLE_ID)) {
    return Privilege.Induction;
  }
  if (member.roles.cache.has(OFFICERS_ROLE_ID)) {
    return Privilege.Officer;
  }
  if (member.roles.cache.has(MEMBERS_ROLE_ID)) {
    return Privilege.Member;
  }
  if (member.roles.cache.has(INDUCTEES_ROLE_ID)) {
    return Privilege.Inductee;
  }
  return Privilege.None;
}

export function isAuthorized(member: GuildMember, level: Privilege): boolean {
  return highestPrivilege(member) >= level;
}

type Payload = SlashCommandCheckDetails<{
  member: GuildMember;
  callerPrivilege: Privilege;
}>;

export class PrivilegeCheck extends SlashCommandCheck<Payload> {
  private level = Privilege.None;

  public override predicate(
    interaction: ChatInputCommandInteraction,
  ): Payload {
    const { member } = interaction;
    if (!(member instanceof GuildMember)) {
      throw new Error(`non-GuildMember interaction member: ${member}`);
    }
    const callerPrivilege = highestPrivilege(member);
    return {
      pass: callerPrivilege >= this.level,
      member,
      callerPrivilege,
    };
  }

  public override async onFail(
    details: Payload & { pass: false },
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { member, callerPrivilege } = details;
    console.log(
      `[CHECK] ${this.handler.id} blocked for @${member.user.username}: ` +
      `privilege ${Privilege[callerPrivilege]} < ${Privilege[this.level]}.`,
    );

    const diffBlock = codeBlock("diff", (
      `+ Your highest: ${Privilege[callerPrivilege]}\n` +
      `- Min required: ${Privilege[this.level]}`
    ));
    const content = (
      `${userMention(member.id)}, you do not have sufficient privilege ` +
      `to use this command.\n${diffBlock}`
    );

    await this.safeReply(interaction, { content, ephemeral: true });
  }

  public atLeast(level: Privilege): this {
    this.level = level;
    return this;
  }
}
