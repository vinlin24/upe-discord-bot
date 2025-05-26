import {
  codeBlock,
  GuildMember,
  userMention,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  SlashCommandCheck,
  type SlashCommandCheckDetails,
} from "../abc/check.abc";
import type { RoleId } from "../types/branded.types";
import { BidirectionalMap } from "../utils/data.utils";
import {
  ADMINS_ROLE_ID,
  DEVELOPER_ROLE_ID,
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

export const PRIVILEGE_ROLES = new BidirectionalMap<Privilege, RoleId>([
  [Privilege.Inductee, INDUCTEES_ROLE_ID],
  [Privilege.Member, MEMBERS_ROLE_ID],
  [Privilege.Officer, OFFICERS_ROLE_ID],
  [Privilege.Induction, INDUCTION_AND_MEMBERSHIP_ROLE_ID],
  [Privilege.Administrator, ADMINS_ROLE_ID],
  [Privilege.Developer, DEVELOPER_ROLE_ID],
]);

export const PRIVILEGE_VALUES: Readonly<Privilege[]>
  = getNumericEnumValues(Privilege);

// For highestPrivilege() checking.
const REVERSED_PRIVILEGE_VALUES: Readonly<Privilege[]> = PRIVILEGE_VALUES
  .slice()
  .sort((lhs, rhs) => rhs - lhs);

export function highestPrivilege(member: GuildMember): Privilege {
  // Iterate from highest -> lowest privilege, returning the first privilege
  // value whose role the member possesses.

  for (const privilegeValue of REVERSED_PRIVILEGE_VALUES) {
    const roleId = PRIVILEGE_ROLES.get(privilegeValue);
    // Shouldn't happen, or iterated to `Privilege.None`.
    if (roleId === undefined) {
      continue;
    }
    if (member.roles.cache.has(roleId)) {
      return privilegeValue;
    }
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
