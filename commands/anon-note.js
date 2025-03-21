const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('anon-note')
		.setDescription('Report an issue anonymously'),
	category: 'Moderation',
	async execute(interaction) {
		try {
			const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
			await guild.members.fetch(interaction.user.id);
			const noteRow = new ActionRowBuilder();
			const noteBox = new TextInputBuilder()
				.setCustomId('anonNote_content')
				.setLabel('Note')
				.setPlaceholder('What\'s on your mind?')
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(2000)
				.setRequired(true);
			noteRow.addComponents(noteBox);
			const modal = new ModalBuilder()
				.setCustomId(`anonNoteModal_${interaction.user.id}`)
				.setTitle('Submit Anonymous Note')
				.addComponents(noteRow);
			await interaction.showModal(modal);
		} catch (e) {
			console.log('Error while showing anon-note modal: ', e);
			await interaction.reply({ content: 'Sorry, something went wrong. If this error persists, ping Meme or a mod.', ephemeral: true });
		}
	},
};