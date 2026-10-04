require('dotenv').config();

const {
  REST,
  Routes
} = require('discord.js');

const ping = require('./commands/ping');

const commands = [
  ping.data.toJSON()
];

if (
  !process.env.DISCORD_TOKEN ||
  !process.env.CLIENT_ID ||
  !process.env.GUILD_ID
) {
  console.error(
    'Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env'
  );

  process.exit(1);
}

const rest = new REST({
  version: '10'
}).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering guild slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      'Slash commands registered successfully.'
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
