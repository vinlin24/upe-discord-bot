import {
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import type { RoleId } from "../../types/branded.types";
import { isMongoDuplicateKeyError } from "../../utils/errors.utils";
import { BYTE_ROLE_ID } from "../../utils/snowflakes.utils";
import { BitByteGroupModel, type BitByteGroup } from "./bit-byte.model";

class CreateByteGroupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("createbytegroup")
    .setDescription("Register a bit-byte group from its Discord role.")
    .addRoleOption(input => input
      .setName("group_role")
      .setDescription("Custom role for this bit-byte group.")
      .setRequired(true)
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Induction),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const groupRole = interaction.options.getRole("group_role", true) as Role;
    const groupMention = roleMention(groupRole.id);

    const group: BitByteGroup = {
      roleId: groupRole.id as RoleId,
      events: [],
      jeopardyPoints: 0,
    };

    const success = await this.insertDocument(group);
    if (!success) {
      await this.replyError(
        interaction,
        `${groupMention} is already registered!`,
      );
      return;
    }

    // NOTE: Bytes are calculated on-the-fly from the role the group is
    // associated with and not actually stored in the database. Displaying the
    // bytes list is just a presentation layer thing.
    const bytes = this.getBytes(groupRole);
    const byteMentions = bytes.map(byte => userMention(byte.id));
    const successEmbed = new EmbedBuilder()
      .setColor(groupRole.color)
      .setDescription(
        `Registered ${groupMention} as a bit-byte group!\n` +
        `${roleMention(BYTE_ROLE_ID)}: ${byteMentions.join(", ")}`,
      );
    await interaction.reply({ embeds: [successEmbed] });
  }

  private getBytes(role: Role): GuildMember[] {
    const bytesCollection = role.members
      .filter(member => member.roles.cache.has(BYTE_ROLE_ID));
    return Array.from(bytesCollection.values());
  }

  /**
   * Insert the new group into the database.
   *
   * @returns {true} Saving was successful.
   * @returns {false} The group already exists (as determined by unique field).
   * Any other error would propagate the throw.
   */
  private async insertDocument(group: BitByteGroup): Promise<boolean> {
    const document = new BitByteGroupModel(group);
    try {
      await document.save();
      return true;
    }
    catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }
}

export default new CreateByteGroupCommand();
