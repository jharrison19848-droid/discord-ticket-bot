const {
  SlashCommandBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check whether the ticket bot is online.'),

  async execute(interaction) {
    await interaction.reply({
      content: `Pong! 🏓 WebSocket latency: ${interaction.client.ws.ping}ms`,
      ephemeral: true
    });
  }
};
