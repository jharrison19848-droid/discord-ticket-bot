const closeButton = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

await ticketChannel.send({
  content: `${interaction.user}${moderatorRole ? ` <@&${moderatorRole.id}>` : ''}`,
  embeds: [embed],
  components: [closeButton]
});

await interaction.reply({
  content: `Your ticket has been created: ${ticketChannel}`,
  ephemeral: true
});
});

client.login(process.env.DISCORD_TOKEN);
