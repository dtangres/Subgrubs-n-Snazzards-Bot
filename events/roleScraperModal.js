const { Events } = require('discord.js');
const { fetchSQL } = require('../utils/db');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('roleScraperModal_')) {
			const details = id.replace('roleScraperModal_', '').split('_');
			const [roleID] = details;
			const updatedTitle = interaction.fields.getTextInputValue(`roleScraperModal_title_${roleID}`);
			const updatedNotes = interaction.fields.getTextInputValue(`roleScraperModal_notes_${roleID}`);
			let query = 'SELECT * FROM `achievement` WHERE `id` = ?';
			const queryResult = await fetchSQL(query, [roleID]);
			if (queryResult.length) {
				query = 'UPDATE `achievement` SET `title` = ?, `notes` = ? WHERE `id` = ?';
				await fetchSQL(query, [updatedTitle, updatedNotes, roleID]);
				await interaction.reply({ content: `Updated details for '${updatedTitle}.'`, ephemeral: true });
			} else {
				query = 'INSERT INTO `achievement` VALUES (?, ?, ?)';
				await fetchSQL(query, [updatedTitle, roleID, updatedNotes]);
				await interaction.reply({ content: `Added details for '${updatedTitle}.'`, ephemeral: true });
			}
		}
	},
};