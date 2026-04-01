const { Events, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('achievementRevokeModal_')) {
			const details = id.replace('achievementRevokeModal_', '').split('_');
			const [target, achID] = details;
			// Collect user information
			let query = 'SELECT `achievements` FROM `player` WHERE `snowflake` = ?';
			let queryResult = await fetchSQL(query, [target]);
			const unpacked = queryResult[0].achievements.split(' ');
			// Get title
			query = 'SELECT `title` FROM `achievement` WHERE `id` = ?';
			queryResult = await fetchSQL(query, [achID]);
			const title = queryResult[0].title;
			// Check for key match.
			const confirmText = interaction.fields.getTextInputValue('achievementRevoke_confirm');
			if (confirmText === achID) {
				// Revoke achievement and inform caller (return)
				unpacked.splice(unpacked.indexOf(achID), 1);
				const newAchievements = unpacked.join(' ');
				query = 'UPDATE `player` SET `achievements` = ? WHERE `snowflake` = ?';
				await fetchSQL(query, [newAchievements, target]);
				await interaction.reply({
					content: `Successfully revoked '${title}' (\`${achID}\`) from <@${target}>!`,
					flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
				});
				return;
			} else {
				await interaction.reply({ content: 'Sorry, your text entry didn\'t match, and because of Discord API limitations I can\'t display the same modal again. Apologies for the inconvenience.', flags: MessageFlags.Ephemeral });
				return;
			}
		}
	},
};