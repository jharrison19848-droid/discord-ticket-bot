const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Create the ticket panel.')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription(
        'Need help? Choose the type of ticket you want to open below.\n\n' +
        '🛠️ **Support** — Get help with an issue.\n' +
        '🚨 **Reports** — Report a player or problem.\n' +
        '📋 **Other** — Anything that does not fit the other categories.\n' +
        '🎥 **Streamer Live Request** — Request that a streamer be added to the live notifications.'
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_support')
          .setLabel('Support')
          .setEmoji('🛠️')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('ticket_report')
          .setLabel('Reports')
          .setEmoji('🚨')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId('ticket_other')
          .setLabel('Other')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('streamer_live_request')
          .setLabel('Streamer Live Request')
          .setEmoji('🎥')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.reply({
      content: 'Ticket panel created.',
      ephemeral: true
    });
  }
};
