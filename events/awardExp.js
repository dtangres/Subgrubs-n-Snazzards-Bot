require('dotenv').config();
const { Events } = require('discord.js');
const { expToLevel, expWaitTime, msgExp } = require('../utils/info');
const { fetchSQL } = require('../utils/db');
const { getDefaultEmbed } = require('../utils/stringy');

module.exports = {
	name: Events.MessageCreate,
	async execute(interaction) {
		const snowflake = interaction.author.id;

		// Ignore all other servers
		if (interaction.guildId !== process.env.GUILD_ID) return;
		// Ignore channels off whitelist
		const procChannels = process.env.BLOCKED_PROC_CATEGORIES.split(' ');
		if (procChannels.includes(interaction.channel.parent.id) || procChannels.includes((interaction.channel.parent.parent ?? { id: 'nada' }).id)) return;
		// Ignore bot messages
		if (interaction.author.bot) return;

		// Don't reward players on cooldown
		const now = Date.now();
		const queryResult = await fetchSQL('SELECT `lastExp`, `exp` FROM `player` WHERE `snowflake` = ?', [snowflake]);
		let lastExpTime = null;
		if (queryResult.length) {
			lastExpTime = parseInt(queryResult[0]['lastExp']);
			lastExpTime = isNaN(lastExpTime) ? 0 : lastExpTime;
			if (now - lastExpTime < expWaitTime) return;
		} else {
			await fetchSQL('INSERT INTO `player` (`snowflake`) VALUES (?)', [snowflake]);
			lastExpTime = now;
		}

		// Get level of player
		const oldExp = parseInt(queryResult[0]['exp']);
		const newExp = oldExp + msgExp;

		const oldLevel = Math.floor(expToLevel(oldExp));
		const newLevel = Math.floor(expToLevel(newExp));

		// Update EXP
		await fetchSQL('UPDATE `player` SET `exp` = ?, `lastExp` = ? WHERE `snowflake` = ?', [newExp, now, snowflake]);
		// Console.log(`Awarded ${msgExp} exp to ${snowflake} (${oldLevel} (${oldExp}) -> ${newLevel} (${newExp}))`);
		// If level changed, send update in requisite channel
		if (oldLevel !== newLevel) {
			const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
			const expChannel = await guild.channels.cache.get(process.env.EXP_CHANNEL);
			const embed = getDefaultEmbed().setDescription(`Congratulations, <@${snowflake}>! You just reached level **${newLevel}**!`);
			await expChannel.send({ embeds: [embed], allowedMentions: { users: [] } });
		}
	},
};