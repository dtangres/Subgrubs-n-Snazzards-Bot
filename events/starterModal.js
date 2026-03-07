const { Events, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { titleCase } = require('../utils/stringy');
const { starterTypes } = require('../utils/info');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('starter_add_')) {
			const details = id.replace('starter_add_', '').split('_');
			const [user, name] = details;
			let updatedText, query;
			for (let i = 0; i < 3; i++) {
				updatedText = interaction.fields.getTextInputValue(`${id}_${starterTypes[i]}`).replace('`', '');
				query = 'INSERT INTO `starter` VALUES (?, ?, ?, ?)';
				await fetchSQL(query, [user, name, starterTypes[i], updatedText]);
			}
			await interaction.reply({ content: `Succesfully added text for ${titleCase(name)}!`, flags: MessageFlags.Ephemeral });
		} else if (id.startsWith('starter_edit_')) {
			const details = id.replace('starter_edit_', '').split('_');
			const [user, name] = details;
			let updatedText, query;
			for (let i = 0; i < 3; i++) {
				updatedText = interaction.fields.getTextInputValue(`${id}_${starterTypes[i]}`).replace('`', '');
				query = 'UPDATE `starter` SET `content` = ? WHERE `snowflake` = ? AND `name` = ? AND `type` = ?';
				await fetchSQL(query, [updatedText, user, name, starterTypes[i]]);
			}
			await interaction.reply({ content: `Succesfully updated text for ${titleCase(name)}!`, flags: MessageFlags.Ephemeral });
		} else if (id.startsWith('starter_remove_')) {
			const details = id.replace('starter_remove_', '').replace('_confirm', '').split('_');
			const [user, name] = details;
			const confirm = interaction.fields.getTextInputValue(`${id}_confirm`);
			let query;
			if (confirm.toLowerCase() === name) {

				query = 'DELETE FROM `starter` WHERE `snowflake` = ? AND `name` = ?';
				await fetchSQL(query, [user, name]);
				await interaction.reply({ content: `Succesfully removed text for ${titleCase(name)}!`, flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'Sorry, the confirmation prompt failed. Removal canceled.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};