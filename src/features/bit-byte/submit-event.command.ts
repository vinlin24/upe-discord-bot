import {
  bold,
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  type Attachment,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { RoleCheck } from "../../middleware/role.middleware";
import channelsService from "../../services/channels.service";
import type { RoleId, UrlString } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { EMOJI_FEARFUL, EMOJI_RAISED_EYEBROW } from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { BYTE_ROLE_ID, INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";
import {
  BitByteGroupModel,
  BitByteLocation,
  type BitByteEvent,
} from "./bit-byte.model";
import { calculateBitByteEventPoints } from "./bit-byte.utils";

type ResolvedCommandOptions = {
  location: BitByteLocation;
  caption: string;
  numInductees: number;
  picture: Attachment;
  groupRole: Role;
};

class SubmitEventCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("submitbitbyte")
    .setDescription("Get points for events with your bits!")
    .addStringOption(input => input
      .setName("location")
      .setDescription("Where did you hang out?")
      .setRequired(true)
      .addChoices(
        { name: BitByteLocation.OnCampus, value: BitByteLocation.OnCampus },
        { name: BitByteLocation.Westwood, value: BitByteLocation.Westwood },
        { name: BitByteLocation.LA, value: BitByteLocation.LA },
      )
    )
    .addStringOption(input => input
      .setName("caption")
      .setDescription("Brief summary of what you did.")
      .setRequired(true)
    )
    .addIntegerOption(input => input
      .setName("num_inductees")
      .setDescription("How many bits attended?")
      .setRequired(true)
      .setMinValue(1)
    )
    .addAttachmentOption(input => input
      .setName("picture")
      .setDescription("Please attach a picture of the event.")
      .setRequired(true)
    )
    .addRoleOption(input => input
      .setName("group_role")
      .setDescription("Role associated with the bit-byte group to submit for.")
      .setRequired(true)
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new RoleCheck(this).has(BYTE_ROLE_ID),
  ];

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const options = this.resolveOptions(interaction);

    const groupExists = await this.groupExists(options.groupRole.id as RoleId);
    if (!groupExists) {
      await this.replyError(interaction, (
        `${roleMention(options.groupRole.id)} ` +
        "is not registered as a bit-byte group!"
      ));
      return;
    }

    const numBitsInGroup = this.getNumBitsInGroup(options.groupRole);

    // Check that caller isn't BS'ing.
    if (options.numInductees > numBitsInGroup) {
      await this.replyError(
        interaction,
        `${EMOJI_RAISED_EYEBROW} You don't even have ${options.numInductees} ` +
        `bits in your group. You have ${numBitsInGroup}.`,
      );
      return;
    }

    // So the thing is: the URL of the uploaded attachment is EPHEMERAL, meaning
    // it will expire after some time, so we can't just cheese it by saving that
    // link as our event picture URL. I'll use a hack though: when we echo back
    // the uploaded attachment in our reply, that image is actually assigned a
    // permanent CDN attachment link. We can use that instead! Our flow will be:
    //
    //    1. Prepare the event with the ephemeral URL, which we'll reply with.
    //    2. Fetch our own reply to retrieve its image URL.
    //    3. Update the event with the now permanent image URL.
    //    4. THEN save the event to the database.
    //
    // It's a bit awkward telling the user the submission went through before
    // database state is secured, so worst case error handling: if the saving
    // fails, edit the reply again to display the error.

    const event: BitByteEvent = {
      location: options.location,
      caption: options.caption,
      numAttended: options.numInductees,
      numTotal: numBitsInGroup,
      picture: options.picture.url as UrlString, // To be replaced.
      timestamp: this.dateClient.getNow(),
    };

    const pointsEarned = calculateBitByteEventPoints(event);

    const description = (
      `${bold("Group:")} ${roleMention(options.groupRole.id)}\n` +
      `${bold("Caption:")} ${event.caption}\n` +
      `${bold("Location:")} ${event.location}\n` +
      `${bold("Attendance:")} ${event.numAttended} / ${event.numTotal} bits\n` +
      `${bold("Points Earned:")} ${pointsEarned}`
    );
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle("Bit-Byte Event Submitted")
        .setDescription(description)
      ],
      files: [options.picture],
    });

    const messageReply = await interaction.fetchReply();
    const permaLink = messageReply.attachments.first()!.proxyURL as UrlString;
    event.picture = permaLink;

    try {
      await this.addEvent(options.groupRole.id as RoleId, event);
    }
    catch (error) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          `${EMOJI_FEARFUL} Couldn't save your submission! ` +
          "Developers have been notified."
        )],
        files: [options.picture],
      });
      await channelsService.sendDevError(error as Error, interaction);
    }
  }

  private resolveOptions(
    interaction: ChatInputCommandInteraction,
  ): ResolvedCommandOptions {
    const location
      = interaction.options.getString("location", true) as BitByteLocation;
    const caption = interaction.options.getString("caption", true);
    const numInductees = interaction.options.getInteger("num_inductees", true);
    const picture = interaction.options.getAttachment("picture", true);
    const groupRole = interaction.options.getRole("group_role", true) as Role;
    return { location, caption, numInductees, picture, groupRole };
  }

  private getNumBitsInGroup(groupRole: Role): number {
    return groupRole.members
      .filter(member => member.roles.cache.has(INDUCTEES_ROLE_ID))
      .size;
  }

  private async groupExists(roleId: RoleId): Promise<boolean> {
    const result = await BitByteGroupModel.exists({ roleId });
    return result !== null;
  }

  private async addEvent(
    roleId: RoleId,
    event: BitByteEvent,
  ): Promise<void> {
    await BitByteGroupModel.updateOne(
      { roleId },
      { $push: { events: event } },
    );
  }
}

export default new SubmitEventCommand(new SystemDateClient());
