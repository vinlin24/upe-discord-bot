import {
  bold,
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  type Attachment,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { RoleCheck } from "../../middleware/role.middleware";
import {
  BitByteGroupModel,
  BitByteLocation,
  type BitByteEvent,
} from "../../models/bit-byte.model";
import bitByteService from "../../services/bit-byte.service";
import channelsService from "../../services/channels.service";
import type { RoleId, UrlString } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { EMOJI_FEARFUL } from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { BYTE_ROLE_ID } from "../../utils/snowflakes.utils";
import leaderboardCommand from "./leaderboard.command";

type ResolvedCommandOptions = {
  location: BitByteLocation;
  caption: string;
  numInductees: number;
  picture: Attachment;
};

class SubmitEventCommand extends SlashCommandHandler {
  // TODO: Disabled as it is now over for F25. Re-enable for next season.
  public override readonly shouldRegister = false;

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
      .setName("num_bits")
      .setDescription("How many bits attended? Be honest >:(")
      .setRequired(true)
      .setMinValue(1)
    )
    .addAttachmentOption(input => input
      .setName("picture")
      .setDescription("Please attach a picture of the event.")
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
    const caller = interaction.member as GuildMember;

    const group = await bitByteService.determineGroup(caller);
    if (group === null) {
      await this.replyError(interaction, (
        "You don't seem to be part of a registered bit-byte group!"
      ));
      return;
    }

    // ! assert because caller must have the group role for determineGroup() to
    // have returned non-null. Doesn't feel very clean but ehh.
    const groupRole = caller.roles.cache.get(group.roleId)!;

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
      picture: options.picture.url as UrlString, // To be replaced.
      timestamp: this.dateClient.getNow(),
    };

    const pointsEarned = bitByteService.calculateBitByteEventPoints(event);

    const description = (
      `${bold("Group:")} ${roleMention(groupRole.id)}\n` +
      `${bold("Caption:")} ${event.caption}\n` +
      `${bold("Location:")} ${event.location}\n` +
      `${bold("Attendance:")} ${event.numAttended} bits\n` +
      `${bold("Points Earned:")} ${pointsEarned}`
    );

    const tip = `Check /${leaderboardCommand.definition.name} for rankings!`;
    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Event Submitted")
      .setDescription(description)
      .setColor(groupRole.color)
      .setFooter({ text: tip });

    await interaction.reply({
      embeds: [embed],
      files: [options.picture],
    });

    const messageReply = await interaction.fetchReply();
    const permaLink = messageReply.attachments.first()!.proxyURL as UrlString;
    event.picture = permaLink;

    try {
      await this.addEvent(groupRole.id as RoleId, event);
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
    const numInductees = interaction.options.getInteger("num_bits", true);
    const picture = interaction.options.getAttachment("picture", true);
    return { location, caption, numInductees, picture };
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
