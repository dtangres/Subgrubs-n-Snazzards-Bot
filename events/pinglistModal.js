const { Events } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { titleCase } = require('../utils/stringy');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('pinglist_delete_')) {
			const details = id.replace('pinglist_delete_', '').split('_');
			const [name, user, serverID] = details;
			const confirm = interaction.fields.getTextInputValue(`pinglist_delete_confirm_${name}_${user}_${serverID}`);
			let query;
			if (confirm.toLowerCase() === name) {
				query = 'DELETE FROM `pinglist` WHERE `name` = ? AND `serverID` = ?';
				await fetchSQL(query, [name, serverID]);
				await interaction.reply({ content: `Successfully deleted pinglist for ${titleCase(name)}!`, ephemeral: true });
			} else {
				await interaction.reply({ content: 'Sorry, the confirmation prompt failed. Deletion canceled.', ephemeral: true });
			}
		} else if (id.startsWith('pinglist_rename_')) {
			const details = id.replace('pinglist_rename_', '').split('_');
			const [name, user, serverID] = details;
			const newName = interaction.fields.getTextInputValue(`pinglist_rename_newName_${name}_${user}_${serverID}`);
			let query = 'SELECT * FROM `pinglist` WHERE `name` = ? AND `serverID` = ?';
			const queryResult = await fetchSQL(query, [newName, serverID]);
			if (queryResult.length) {
				await interaction.reply({ content: 'Sorry, a pinglist under that name already exists in the system. Please select another name.\n(If this presents a major inconvenience, ping Meme.)', ephemeral: true });
			} else {
				query = 'UPDATE `pinglist` SET `name` = ? WHERE `name` = ? AND `serverID` = ?';
				await fetchSQL(query, [newName, name, serverID]);
				await interaction.reply({ content: `Renamed pinglist \`${name}\` to \`${newName}\`.`, ephemeral: true });
			}
		}
	},
};