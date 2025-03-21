const { ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder } = require('discord.js');
const { getExcerpt } = require('../utils/stringy');
module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('anon-quote')
		.setType(ApplicationCommandType.Message),
	async execute(interaction) {
		try {
			const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
			// Throws error if user isn't in the guild
			await guild.members.fetch(interaction.user.id);
			const noteRow = new ActionRowBuilder();
			const noteBox = new TextInputBuilder()
				.setCustomId('anonNote_content')
				.setLabel('Note')
				.setPlaceholder('What\'s on your mind?')
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(2000)
				.setValue(`<Type message here>\n\nMessage from \`@${interaction.targetMessage.author.username}\` (${interaction.targetMessage.url})\n>>> ${getExcerpt(interaction.targetMessage.content)}`)
				.setRequired(true);
			noteRow.addComponents(noteBox);
			const modal = new ModalBuilder()
				.setCustomId(`anonNoteModal_${interaction.user.id}_`)
				.setTitle('Submit Anonymous Note')
				.addComponents(noteRow);
			await interaction.showModal(modal);
		} catch (e) {
			console.log('Error while showing anon-quote modal: ', e);
			await interaction.reply('Sorry, but you don\'t have permission to use this command.');
		}
		// Const anonChannel = await interaction.client.guilds.cache.get(process.env.GUILD_ID).channels.cache.get(process.env.ANON_CHANNEL);
		// Await anonChannel.send({ content:`An anonymous user reported a message from Serverstuck user ${interaction.targetMessage.author.user}:`, allowedMentions : { parse: [] } });
		// Await anonChannel.send({ content:`>>> ${getExcerpt(interaction.targetMessage.content)}` });
		// Await anonChannel.send({ content:`To see the message in context, click here: ${interaction.targetMessage.url}` });
		// Await interaction.reply({ content: 'This message has been reported in the anon-note channel!', ephemeral:true });
	},
};