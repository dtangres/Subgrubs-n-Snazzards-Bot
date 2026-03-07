const { Events, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('roleLoggerModal_')) {
			const details = id.replace('roleLoggerModal_', '').split('_');
			const [roleID] = details;
			const updatedTitle = interaction.fields.getTextInputValue(`roleLoggerModal_title_${roleID}`);
			const updatedNotes = interaction.fields.getTextInputValue(`roleLoggerModal_notes_${roleID}`);
			const updatedCategory = interaction.fields.getTextInputValue(`roleLoggerModal_category_${roleID}`);
			let query = 'SELECT * FROM `achievement` WHERE `id` = ?';
			const queryResult = await fetchSQL(query, [roleID]);
			if (queryResult.length) {
				query = 'UPDATE `achievement` SET `title` = ?, `category` = ?, `notes` = ? WHERE `id` = ?';
				await fetchSQL(query, [updatedTitle, updatedCategory, updatedNotes, roleID]);
				await interaction.reply({ content: `Updated details for '${updatedTitle}.'`, flags: MessageFlags.Ephemeral });
			} else {
				query = 'INSERT INTO `achievement` VALUES (?, ?, ?, ?)';
				await fetchSQL(query, [updatedTitle, roleID, updatedCategory, updatedNotes]);
				await interaction.reply({ content: `Added details for '${updatedTitle}.'`, flags: MessageFlags.Ephemeral });
			}
		}
	},
};