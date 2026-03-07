const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;
		const id = interaction.customId;
		if (id.startsWith('anonNoteModal')) {
			const details = id.replace('anonNoteModal_', '').split('_');
			const [snowflake] = details;
			const noteText = interaction.fields.getTextInputValue('anonNote_content');
			const row = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setLabel('↩️ Reply to Note')
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`anonNote_replyButton_${snowflake}`),
				);
			const payload = { content: noteText, components: [row] };
			await interaction.client.guilds.cache.get(process.env.GUILD_ID).channels.cache.get(process.env.ANON_CHANNEL).send(payload);
			await interaction.reply({ content: 'Your message was successfully sent!', allowedMentions: { users: [] }, ephemeral: true });
		} else if (id.startsWith('anonNoteReplyModal')) {
			await interaction.deferReply();
			const details = id.replace('anonNoteReplyModal_', '').split('_');
			const [snowflake] = details;
			const noteText = interaction.fields.getTextInputValue('anonNoteReply_content');
			const payload = { content: noteText };
			await interaction.client.users.fetch(snowflake, false).then((user) => {
				user.send(payload);
			});
			await interaction.editReply({ content: `Your reply was successfully sent:\n\n>>> ${noteText}`, allowedMentions: { users: [] } });
		}
	},
};