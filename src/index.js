require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Collection
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
  require('./commands/ping')
];

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

initializeDatabase();

client.once('ready', (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Serving ${readyClient.guilds.cache.size} server(s).`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
});

client.login(process.env.DISCORD_TOKEN);
