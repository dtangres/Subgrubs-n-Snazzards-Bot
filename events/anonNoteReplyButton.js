const { Events, TextInputBuilder, TextInputStyle, ModalBuilder, LabelBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;
		const id = interaction.customId;
		if (id.startsWith('anonNote_replyButton')) {
			const details = id.replace('anonNote_replyButton_', '').split('_');
			const [snowflake] = details;
			const noteBox = new TextInputBuilder()
				.setCustomId('anonNoteReply_content')
				.setPlaceholder('Enter your reply here')
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(2000)
				.setRequired(true);
			const noteLabel = new LabelBuilder()
				.setLabel('Note Reply')
				.setTextInputComponent(noteBox);
			const modal = new ModalBuilder()
				.setCustomId(`anonNoteReplyModal_${snowflake}`)
				.setTitle('Submit Anonymous Note Reply')
				.addLabelComponents(noteLabel);
			await interaction.showModal(modal);
		}
	},
};