const { Events, ModalBuilder, TextInputStyle, TextInputBuilder, LabelBuilder, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { CHAR_LIMIT } = require('../utils/info');
const { cutoffWithEllipsis } = require('../utils/stringy');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;
		const id = interaction.customId;
		if (id.startsWith('patchEditButton_')) {
			const details = id.replace('patchEditButton_', '').split('_');
			const [table, key, column] = details;
			const modal = new ModalBuilder()
				.setCustomId(`patchEditModal_${table}_${key}_${column}`)
				.setTitle(cutoffWithEllipsis(`Edit ${column} for ${key}`, 45));
			const query = 'SELECT ?? FROM ?? where `key` = ?';
			const queryResult = await fetchSQL(query, [column, table, key]);
			const initialText = queryResult[0][column];
			if (initialText.length > CHAR_LIMIT) {
				await interaction.reply({ content: 'Sorry! Due to Discord\'s API limitations, I can\'t provide this information to you. Please contact another dev to request changes. Apologies for the inconvenience.', flags: MessageFlags.Ephemeral });
			} else {
				const textBox = new TextInputBuilder()
					.setCustomId(`patchEditTextInput_${table}_${key}_${column}`)
					.setLabel('Item text for editing')
					.setStyle(TextInputStyle.Paragraph)
					.setPlaceholder('You\'re gonna leave this blank? On god?')
					.setValue(initialText)
					.setMinLength(0)
					.setMaxLength(4000);
				const textLabel = LabelBuilder()
					.setLabel('Item text for editing')
					.setTextInputComponent(textBox);
				modal.addLabelComponents(textLabel);
				await interaction.showModal(modal);
			}
		}
		return;
	},
};
