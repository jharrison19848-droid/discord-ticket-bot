require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  initializeDatabase
} = require('./database/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.commands = new Collection();

const commands = [
  require('./commands/ping'),
  require('./commands/setup-tickets')
];

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

initializeDatabase();

client.once('ready', async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Serving ${readyClient.guilds.cache.size} server(s).`);

  try {
    const rest = new REST({
      version: '10'
    }).setToken(process.env.DISCORD_TOKEN);

    const commandData = commands.map(command =>
      command.data.toJSON()
    );

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commandData
      }
    );

    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `Command /${interaction.commandName} failed:`,
        error
      );

      const message = {
        content: 'Something went wrong while running that command.',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message);
      } else {
        await interaction.reply(message);
      }
    }

    return;
  }

  // Buttons
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith('ticket_')) return;

  // Close ticket
  if (interaction.customId === 'ticket_close') {
    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      return;
    }

    const member = interaction.member;

    const isAdministrator = member.permissions.has(
      PermissionFlagsBits.Administrator
    );

    const isModerator = member.roles.cache.some(
      role => role.name === 'Moderator'
    );

    if (!isAdministrator && !isModerator) {
      await interaction.reply({
        content: 'Only Administrators and Moderators can close tickets.',
        ephemeral: true
      });

      return;
    }

    await interaction.reply({
      content: '🔒 This ticket will be closed in 5 seconds.'
    });

    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (error) {
        console.error(
          'Failed to delete ticket channel:',
          error
        );
      }
    }, 5000);

    return;
  }

  // Determine ticket type
  const ticketType = interaction.customId.replace(
    'ticket_',
    ''
  );

  const typeNames = {
    support: 'Support',
    report: 'Report',
    other: 'Other'
  };

  const typeName = typeNames[ticketType];

  if (!typeName) return;

  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({
      content: 'Tickets can only be created inside a server.',
      ephemeral: true
    });

    return;
  }

  // Find Moderator role
  const moderatorRole = guild.roles.cache.find(
    role => role.name === 'Moderator'
  );

  // Prevent multiple open tickets
  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic === `ticket-owner:${interaction.user.id}`
  );

  if (existingTicket) {
    await interaction.reply({
      content: `You already have an open ticket: ${existingTicket}`,
      ephemeral: true
    });

    return;
  }

  // Generate ticket number
  const ticketNumber = Date.now().toString().slice(-6);

  const channelName = `${ticketType}-${ticketNumber}`;

  // Ticket permissions
  const permissionOverwrites = [
  {
    id: guild.roles.everyone.id,
    deny: [
      PermissionFlagsBits.ViewChannel
    ]
  },
  {
    id: interaction.client.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageChannels
    ]
  },
  {
    id: interaction.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageChannels
    ]
  },
  {
    id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  // Moderator access
  if (moderatorRole) {
    permissionOverwrites.push({
      id: moderatorRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    });
  }

  // Create ticket channel
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: `ticket-owner:${interaction.user.id}`,
    permissionOverwrites
  });

  // Ticket welcome message
  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${typeName} Ticket`)
    .setDescription(
      `Welcome ${interaction.user}!\n\n` +
      `A member of the staff team will be with you shortly.\n\n` +
      `**Ticket Type:** ${typeName}`
    );

  // Close button
  const closeButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

  // Send ticket message
  await ticketChannel.send({
    content: `${interaction.user}${moderatorRole ? ` <@&${moderatorRole.id}>` : ''}`,
    embeds: [embed],
    components: [closeButton]
  });

  // Tell user the ticket was created
  await interaction.reply({
    content: `Your ticket has been created: ${ticketChannel}`,
    ephemeral: true
  });
});

client.login(process.env.DISCORD_TOKEN);
