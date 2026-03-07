const { Events, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { camelize } = require('../utils/stringy');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('patchEditModal_')) {
			const details = id.replace('patchEditModal_', '').split('_');
			const [table, key, column] = details;
			const updatedText = interaction.fields.getTextInputValue(`patchEditTextInput_${table}_${key}_${column}`);
			const query = 'UPDATE ?? SET ?? = ? WHERE `key` = ?';
			await fetchSQL(query, [table, column, updatedText, key]);
			await interaction.reply({ content: `Updated column \`${column}\` for key \`${key}\` in table \`${table}\` to new value.`, flags: MessageFlags.Ephemeral });
		} else if (id.startsWith('patchAddModal_')) {
			const details = id.replace('patchAddModal_', '').split('_');
			const [table] = details;
			let query = 'SHOW COLUMNS FROM ??';
			const queryResult = await fetchSQL(query, [table]);
			const values = [];
			let key;
			for (const item of queryResult) {
				const label = item['Field'];
				if (label === 'key') continue;
				if (label === 'title') {
					key = camelize(interaction.fields.getTextInputValue(`patchAddTextInput_${table}_${label}`));
					values.push(key);
				}
				values.push(interaction.fields.getTextInputValue(`patchAddTextInput_${table}_${label}`));
			}
			query = 'INSERT INTO ?? VALUES (?);';
			await fetchSQL(query, [table, values]);
			await interaction.reply({ content: `Added entry \`${key}\` in table \`${table}\` to new value.`, flags: MessageFlags.Ephemeral });
		} else if (id.startsWith('patchDropModal_')) {
			const details = id.replace('patchDropModal_', '').split('_');
			const [table, key] = details;
			const confirmText = interaction.fields.getTextInputValue(`patchDropTextInput_${table}_${key}`);
			if (confirmText === key) {
				const query = 'DELETE FROM ?? WHERE `key` = ?';
				await fetchSQL(query, [table, key]);
				await interaction.reply({ content: `Removed entry \`${key}\` in table \`${table}\`.`, flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'Sorry, your text entry didn\'t match, and because of Discord API limitations I can\'t display the same modal again. Apologies for the inconvenience.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};