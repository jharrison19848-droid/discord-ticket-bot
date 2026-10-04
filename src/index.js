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

  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith('ticket_')) return;

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

  const moderatorRole = guild.roles.cache.find(
    role => role.name === 'Moderator'
  );

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

  const ticketNumber = Date.now().toString().slice(-6);

  const channelName =
    `${ticketType}-${ticketNumber}`;

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.ViewChannel
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

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: `ticket-owner:${interaction.user.id}`,
    permissionOverwrites
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${typeName} Ticket`)
    .setDescription(
      `Welcome ${interaction.user}!\n\n` +
      `A member of the staff team will be with you shortly.\n\n` +
      `**Ticket Type:** ${typeName}`
    );

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
