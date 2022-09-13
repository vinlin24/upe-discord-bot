import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Get points for events with your Byte family!")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Where did your family hang out?")
        .setRequired(true)
        .addChoices(
          { name: "On-campus", value: "campus" },
          { name: "Westwood", value: "westwood" },
          { name: "LA", value: "la" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("caption")
        .setDescription("Brief summary of what your family did")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("members")
        .setDescription("How many members attended?")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("picture")
        .setDescription("Please attach a picture of the event")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const location = interaction.options.getString("location");
    const caption = interaction.options.getString('caption')
    const numMembers = interaction.options.getInteger("members");
    const picture = interaction.options.getAttachment("picture");
    const userId = interaction.user.id;

    await interaction.reply(
      `UserId: ${userId}\nLocation: ${location}\nDescription: ${caption}\nMembers: ${numMembers}\nPicture: ${picture?.url}`
    );
  },
};
