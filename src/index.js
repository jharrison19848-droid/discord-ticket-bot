```js
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
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');

const {
  initializeDatabase,
  getDatabase,
  updateDatabase
} = require('./database/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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
  console.log('Logged in as ' + readyClient.user.tag);
  console.log(
    'Serving ' +
      readyClient.guilds.cache.size +
      ' server(s).'
  );

  try {
    const rest = new REST({
      version: '10'
    }).setToken(process.env.DISCORD_TOKEN);

    const commandData = commands.map(
      (command) => command.data.toJSON()
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

    console.log(
      'Slash commands registered successfully.'
    );
  } catch (error) {
    console.error(
      'Failed to register slash commands:',
      error
    );
  }
});

client.on(
  'interactionCreate',
  async (interaction) => {

    // ============================================================
    // SLASH COMMANDS
    // ============================================================

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(
        interaction.commandName
      );

      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          'Command failed:',
          error
        );

        const message = {
          content:
            'Something went wrong while running that command.',
          ephemeral: true
        };

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp(
            message
          );
        } else {
          await interaction.reply(
            message
          );
        }
      }

      return;
    }

    // ============================================================
    // STREAMER LIVE REQUEST BUTTON
    // ============================================================

    if (
      interaction.isButton() &&
      interaction.customId ===
        'streamer_live_request'
    ) {
      const modal =
        new ModalBuilder()
          .setCustomId(
            'streamer_live_request_modal'
          )
          .setTitle(
            'Streamer Live Request'
          );

      const streamerName =
        new TextInputBuilder()
          .setCustomId(
            'streamer_name'
          )
          .setLabel(
            'Twitch Username'
          )
          .setPlaceholder(
            'Example: mft_grim'
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true);

      const streamerLink =
        new TextInputBuilder()
          .setCustomId(
            'streamer_link'
          )
          .setLabel(
            'Twitch Channel Link'
          )
          .setPlaceholder(
            'Example: https://twitch.tv/mft_grim'
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          streamerName
        ),
        new ActionRowBuilder().addComponents(
          streamerLink
        )
      );

      await interaction.showModal(
        modal
      );

      return;
    }

    // ============================================================
    // STREAMER LIVE REQUEST SUBMISSION
    // ============================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId ===
        'streamer_live_request_modal'
    ) {
      const guild =
        interaction.guild;

      if (!guild) {
        await interaction.reply({
          content:
            'Streamer requests can only be submitted inside a server.',
          ephemeral: true
        });

        return;
      }

      const streamerName =
        interaction.fields.getTextInputValue(
          'streamer_name'
        );

      const streamerLink =
        interaction.fields.getTextInputValue(
          'streamer_link'
        );

      const moderatorRole =
        guild.roles.cache.find(
          (role) =>
            role.name === 'Moderator'
        );

      // Prevent multiple open requests
      const existingRequest =
        guild.channels.cache.find(
          (channel) =>
            channel.type ===
              ChannelType.GuildText &&
            channel.topic ===
              'streamer-request-owner:' +
                interaction.user.id
        );

      if (existingRequest) {
        await interaction.reply({
          content:
            'You already have an open streamer request: ' +
            existingRequest,
          ephemeral: true
        });

        return;
      }

      const requestNumber =
        Date.now()
          .toString()
          .slice(-6);

      const channelName =
        'streamer-request-' +
        requestNumber;

      // Private permissions
      const permissionOverwrites = [
        {
          id:
            guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },
        {
          id:
            client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        },
        {
          id:
            interaction.user.id,
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
          id:
            moderatorRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        });
      }

      // Create private request channel
      const requestChannel =
        await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic:
            'streamer-request-owner:' +
            interaction.user.id,
          permissionOverwrites
        });

      const requestEmbed =
        new EmbedBuilder()
          .setTitle(
            '🎥 Streamer Live Request'
          )
          .setDescription(
            interaction.user.toString() +
              ' submitted a streamer live request.'
          )
          .addFields(
            {
              name:
                'Twitch Username',
              value:
                streamerName,
              inline: true
            },
            {
              name:
                'Twitch Channel',
              value:
                streamerLink,
              inline: false
            },
            {
              name:
                'Requested By',
              value:
                interaction.user.toString(),
              inline: false
            }
          )
          .setTimestamp();

      const completedButton =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                'streamer_request_completed'
              )
              .setLabel(
                'Completed'
              )
              .setEmoji('✅')
              .setStyle(
                ButtonStyle.Success
              )
          );

      await requestChannel.send({
        content:
          interaction.user.toString() +
          (
            moderatorRole
              ? ' <@&' +
                moderatorRole.id +
                '>'
              : ''
          ),
        embeds: [
          requestEmbed
        ],
        components: [
          completedButton
        ]
      });

      await interaction.reply({
        content:
          'Your streamer live request has been submitted: ' +
          requestChannel,
        ephemeral: true
      });

      console.log(
        'Streamer live request ' +
          requestNumber +
          ' created by ' +
          interaction.user.tag
      );

      return;
    }

    // ============================================================
    // STREAMER LIVE REQUEST COMPLETED
    // ============================================================

    if (
      interaction.isButton() &&
      interaction.customId ===
        'streamer_request_completed'
    ) {
      const channel =
        interaction.channel;

      const guild =
        interaction.guild;

      if (
        !channel ||
        channel.type !==
          ChannelType.GuildText ||
        !guild
      ) {
        return;
      }

      const member =
        interaction.member;

      const isAdministrator =
        member.permissions.has(
          PermissionFlagsBits.Administrator
        );

      const isModerator =
        member.roles.cache.some(
          (role) =>
            role.name === 'Moderator'
        );

      if (
        !isAdministrator &&
        !isModerator
      ) {
        await interaction.reply({
          content:
            'Only Administrators and Moderators can complete streamer requests.',
          ephemeral: true
        });

        return;
      }

      // Get requester from channel topic
      const ownerMatch =
        (
          channel.topic || ''
        ).match(
          /^streamer-request-owner:(\d+)$/
        );

      if (!ownerMatch) {
        await interaction.reply({
          content:
            'I could not determine who submitted this request.',
          ephemeral: true
        });

        return;
      }

      const requesterId =
        ownerMatch[1];

      // Find closed-ticket log channel
      const closedTicketsChannel =
        guild.channels.cache.find(
          (candidate) =>
            candidate.type ===
              ChannelType.GuildText &&
            candidate.name.toLowerCase() ===
              '🎫-closed-tickets'
        );

      if (!closedTicketsChannel) {
        await interaction.reply({
          content:
            'I could not find the 🎫-closed-tickets channel.',
          ephemeral: true
        });

        return;
      }

      // Find original request message
      const messages =
        await channel.messages.fetch({
          limit: 100
        });

      const requestMessage =
        messages.find(
          (message) =>
            message.author.id ===
              client.user.id &&
            message.embeds.length >
              0 &&
            message.embeds[0].title ===
              '🎥 Streamer Live Request'
        );

      const logEmbed =
        new EmbedBuilder()
          .setTitle(
            '✅ Streamer Live Request Completed'
          )
          .addFields(
            {
              name:
                'Requested By',
              value:
                '<@' +
                requesterId +
                '>',
              inline: true
            },
            {
              name:
                'Completed By',
              value:
                interaction.user.toString(),
              inline: true
            }
          )
          .setTimestamp();

      // Copy streamer information
      if (requestMessage) {
        for (
          const field
          of requestMessage.embeds[0].fields
        ) {
          if (
            field.name !==
            'Requested By'
          ) {
            logEmbed.addFields({
              name:
                field.name,
              value:
                field.value,
              inline:
                field.inline
            });
          }
        }
      }

      // Send completed request to log channel
      await closedTicketsChannel.send({
        embeds: [
          logEmbed
        ]
      });

      // DM requester
      try {
        const requester =
          await client.users.fetch(
            requesterId
          );

        await requester.send(
          'Your streamer live request has been completed. ✅'
        );
      } catch (error) {
        console.log(
          'Could not DM requester ' +
            requesterId +
            '. Their DMs may be closed.'
        );
      }

      await interaction.reply({
        content:
          'Request completed. It has been logged and the requester has been notified.',
        ephemeral: true
      });

      console.log(
        'Streamer live request completed by ' +
          interaction.user.tag
      );

      // Delete request channel
      setTimeout(
        async () => {
          try {
            await channel.delete();
          } catch (error) {
            console.error(
              'Failed to delete streamer request channel:',
              error
            );
          }
        },
        5000
      );

      return;
    }

    // ============================================================
    // REGULAR TICKET BUTTONS
    // ============================================================

    if (!interaction.isButton()) {
      return;
    }

    if (
      !interaction.customId.startsWith(
        'ticket_'
      )
    ) {
      return;
    }

    // ============================================================
    // CLOSE REGULAR TICKET
    // ============================================================

    if (
      interaction.customId ===
      'ticket_close'
    ) {
      const channel =
        interaction.channel;

      const guild =
        interaction.guild;

      if (
        !channel ||
        channel.type !==
          ChannelType.GuildText ||
        !guild
      ) {
        return;
      }

      const member =
        interaction.member;

      const isAdministrator =
        member.permissions.has(
          PermissionFlagsBits.Administrator
        );

      const isModerator =
        member.roles.cache.some(
          (role) =>
            role.name ===
            'Moderator'
        );

      if (
        !isAdministrator &&
        !isModerator
      ) {
        await interaction.reply({
          content:
            'Only Administrators and Moderators can close tickets.',
          ephemeral: true
        });

        return;
      }

      const database =
        getDatabase();

      const ticket =
        database.tickets.find(
          (item) =>
            item.channel_id ===
              channel.id &&
            !item.closed_at
        );

      if (ticket) {

        // Fetch ticket messages
        let messages = [];
        let lastMessageId;

        while (true) {
          const fetched =
            await channel.messages.fetch({
              limit: 100,
              ...(lastMessageId
                ? {
                    before:
                      lastMessageId
                  }
                : {})
            });

          if (
            fetched.size === 0
          ) {
            break;
          }

          messages.push(
            ...fetched.values()
          );

          lastMessageId =
            fetched.last().id;

          if (
            fetched.size < 100
          ) {
            break;
          }
        }

        // Oldest to newest
        messages.sort(
          (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
        );

        // User/staff messages only
        const transcriptMessages =
          messages.filter(
            (message) =>
              !message.author.bot
          );

        let transcript =
          'Ticket #' +
          ticket.ticket_id +
          '\n' +
          'Type: ' +
          ticket.type_name +
          '\n' +
          'Opened by: ' +
          ticket.user_tag +
          '\n' +
          'Closed by: ' +
          interaction.user.tag +
          '\n' +
          'Opened: ' +
          ticket.opened_at +
          '\n' +
          'Closed: ' +
          new Date().toISOString() +
          '\n' +
          '\n========================================\n' +
          'TRANSCRIPT\n' +
          '========================================\n\n';

        for (
          const message
          of transcriptMessages
        ) {
          const timestamp =
            new Date(
              message.createdTimestamp
            ).toISOString();

          transcript +=
            '[' +
            timestamp +
            '] ' +
            message.author.tag +
            ':\n';

          if (
            message.content
          ) {
            transcript +=
              message.content +
              '\n';
          }

          if (
            message.attachments
              .size > 0
          ) {
            for (
              const attachment
              of message.attachments.values()
            ) {
              transcript +=
                '[Attachment: ' +
                attachment.url +
                ']\n';
            }
          }

          transcript +=
            '\n';
        }

        const transcriptFile =
          Buffer.from(
            transcript,
            'utf8'
          );

        // Update database
        ticket.closed_by =
          interaction.user.id;

        ticket.closed_by_tag =
          interaction.user.tag;

        ticket.closed_at =
          new Date().toISOString();

        updateDatabase();

        console.log(
          'Ticket #' +
            ticket.ticket_id +
            ' closed by ' +
            interaction.user.tag
        );

        // Find closed ticket channel
        const closedTicketsChannel =
          guild.channels.cache.find(
            (candidate) =>
              candidate.type ===
                ChannelType.GuildText &&
              candidate.name.toLowerCase() ===
                '🎫-closed-tickets'
          );

        if (
          closedTicketsChannel
        ) {
          const openedTime =
            Math.floor(
              new Date(
                ticket.opened_at
              ).getTime() /
                1000
            );

          const closedTime =
            Math.floor(
              new Date(
                ticket.closed_at
              ).getTime() /
                1000
            );

          const logEmbed =
            new EmbedBuilder()
              .setTitle(
                '🔒 Ticket Closed'
              )
              .addFields(
                {
                  name:
                    'Ticket',
                  value:
                    '#' +
                    ticket.ticket_id,
                  inline: true
                },
                {
                  name:
                    'Type',
                  value:
                    ticket.type_name,
                  inline: true
                },
                {
                  name:
                    'Opened By',
                  value:
                    '<@' +
                    ticket.user_id +
                    '>',
                  inline: true
                },
                {
                  name:
                    'Closed By',
                  value:
                    '<@' +
                    interaction.user.id +
                    '>',
                  inline: true
                },
                {
                  name:
                    'Opened',
                  value:
                    '<t:' +
                    openedTime +
                    ':F>',
                  inline: false
                },
                {
                  name:
                    'Closed',
                  value:
                    '<t:' +
                    closedTime +
                    ':F>',
                  inline: false
                }
              )
              .setTimestamp();

          await closedTicketsChannel.send({
            embeds: [
              logEmbed
            ],
            files: [
              new AttachmentBuilder(
                transcriptFile,
                {
                  name:
                    'ticket-' +
                    ticket.ticket_id +
                    '-transcript.txt'
                }
              )
            ]
          });
        }
      }

      await interaction.reply({
        content:
          '🔒 This ticket will be closed in 5 seconds.'
      });

      setTimeout(
        async () => {
          try {
            await channel.delete();
          } catch (error) {
            console.error(
              'Failed to delete ticket channel:',
              error
            );
          }
        },
        5000
      );

      return;
    }

    // ============================================================
    // DETERMINE REGULAR TICKET TYPE
    // ============================================================

    const ticketType =
      interaction.customId.replace(
        'ticket_',
        ''
      );

    const typeNames = {
      support: 'Support',
      report: 'Report',
      other: 'Other'
    };

    const typeName =
      typeNames[ticketType];

    if (!typeName) {
      return;
    }

    const guild =
      interaction.guild;

    if (!guild) {
      await interaction.reply({
        content:
          'Tickets can only be created inside a server.',
        ephemeral: true
      });

      return;
    }

    // Find Moderator role
    const moderatorRole =
      guild.roles.cache.find(
        (role) =>
          role.name ===
          'Moderator'
      );

    // Prevent multiple open tickets
    const existingTicket =
      guild.channels.cache.find(
        (channel) =>
          channel.type ===
            ChannelType.GuildText &&
          channel.topic ===
            'ticket-owner:' +
              interaction.user.id
      );

    if (existingTicket) {
      await interaction.reply({
        content:
          'You already have an open ticket: ' +
          existingTicket,
        ephemeral: true
      });

      return;
    }

    // Generate ticket number
    const ticketNumber =
      Date.now()
        .toString()
        .slice(-6);

    const channelName =
      ticketType +
      '-' +
      ticketNumber;

    // Ticket permissions
    const permissionOverwrites = [
      {
        id:
          guild.roles.everyone.id,
        deny: [
          PermissionFlagsBits.ViewChannel
        ]
      },
      {
        id:
          client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels
        ]
      },
      {
        id:
          interaction.user.id,
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
        id:
          moderatorRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels
        ]
      });
    }

    // Create ticket channel
    const ticketChannel =
      await guild.channels.create({
        name:
          channelName,
        type:
          ChannelType.GuildText,
        topic:
          'ticket-owner:' +
          interaction.user.id,
        permissionOverwrites
      });

    // Record ticket
    const database =
      getDatabase();

    const ticketId =
      database.next_ticket_id;

    database.tickets.push({
      ticket_id:
        ticketId,
      guild_id:
        guild.id,
      channel_id:
        ticketChannel.id,
      channel_name:
        ticketChannel.name,
      user_id:
        interaction.user.id,
      user_tag:
        interaction.user.tag,
      type:
        ticketType,
      type_name:
        typeName,
      opened_at:
        new Date().toISOString(),
      closed_by:
        null,
      closed_at:
        null
    });

    database.next_ticket_id++;

    updateDatabase();

    console.log(
      'Ticket #' +
        ticketId +
        ' created by ' +
        interaction.user.tag
    );

    // Ticket welcome message
    const embed =
      new EmbedBuilder()
        .setTitle(
          '🎫 ' +
            typeName +
            ' Ticket'
        )
        .setDescription(
          'Welcome ' +
            interaction.user +
            '!\n\n' +
            'A member of the staff team will be with you shortly.\n\n' +
            '**Ticket Type:** ' +
            typeName +
            '\n' +
            '**Ticket ID:** #' +
            ticketId
        );

    // Close button
    const closeButton =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              'ticket_close'
            )
            .setLabel(
              'Close Ticket'
            )
            .setEmoji('🔒')
            .setStyle(
              ButtonStyle.Danger
            )
        );

    // Send ticket message
    await ticketChannel.send({
      content:
        interaction.user.toString() +
        (
          moderatorRole
            ? ' <@&' +
              moderatorRole.id +
              '>'
            : ''
        ),
      embeds: [
        embed
      ],
      components: [
        closeButton
      ]
    });

    // Tell user
    await interaction.reply({
      content:
        'Your ticket has been created: ' +
        ticketChannel,
      ephemeral: true
    });
  }
);

client.login(
  process.env.DISCORD_TOKEN
);
```
