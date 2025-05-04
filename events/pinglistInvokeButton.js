const { Events } = require('discord.js');
const { fetchSQL } = require('../utils/db');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;
		const id = interaction.customId;
		const user = interaction.user.id;
		if (id.startsWith('pinglist_join_')) {
			const details = id.replace('pinglist_join_', '').split('_');
			const [name, serverID] = details;
			let query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `record` = \'owner\' AND `snowflake` = ? AND `serverID` = ?';
			let result = await fetchSQL(query, [name, user, serverID]);
			if (result.length) {
				await interaction.reply({ content: 'You are an owner of this pinglist; you don\'t need to join!', ephemeral: true });
			} else {
				query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `record` = \'subscriber\' AND `snowflake` = ? AND `serverID` = ?';
				result = await fetchSQL(query, [name, user, serverID]);
				if (!result.length) {
					query = 'INSERT INTO `pinglist` VALUES (?, \'subscriber\', ?, ?)';
					await fetchSQL(query, [user, name, serverID]);
					await interaction.reply({ content: `You joined the \`${name}\` pinglist!`, ephemeral: true });
				} else {
					await interaction.reply({ content: `Looks like you're already in the \`${name}\` pinglist! Nice!`, ephemeral: true });
				}
			}
		} else if (id.startsWith('pinglist_leave_')) {
			const details = id.replace('pinglist_leave_', '').split('_');
			const [name, serverID] = details;
			let query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `record` = \'owner\' AND `snowflake` = ? AND `serverID` = ?';
			let result = await fetchSQL(query, [name, user, serverID]);
			if (result.length) {
				query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `record` = \'owner\' AND `serverID` = ?';
				result = await fetchSQL(query, [name, serverID]);
				if (result.length === 1) {
					await interaction.reply({ content: `Leaving your own pinglist? Use \`/pinglist delete ${name}\` instead.`, ephemeral: true });
				} else {
					query = 'DELETE FROM `pinglist` WHERE `name` = ? AND `snowflake` = ? AND `record` = \'owner\' AND `serverID` = ?';
					await fetchSQL(query, [name, user, serverID]);
					await interaction.reply({ content: `You've left the \`${name}\` pinglist! Goodbye!`, ephemeral: true });
				}
			} else {
				query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `record` = \'subscriber\' AND `snowflake` = ? AND `serverID` = ?';
				result = await fetchSQL(query, [name, user, serverID]);
				if (!result.length) {
					await interaction.reply({ content: `You don't seem to be in the \`${name}\` pinglist!`, ephemeral: true });
				} else {
					query = 'DELETE FROM `pinglist` WHERE `name` = ? AND `snowflake` = ? AND `record` = \'subscriber\' AND `serverID` = ?';
					await fetchSQL(query, [name, user, serverID]);
					await interaction.reply({ content: `You've left the \`${name}\` pinglist! Goodbye!`, ephemeral: true });
				}
			}
		}
	},
};
