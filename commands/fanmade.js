const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fanmadeLinks } = require('../utils/info');
const { easyListItems } = require('../utils/math');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('fanmade')
		.setDescription('Retrieve fanmade resource')
		.addStringOption(option =>
			option.setName('document')
				.setDescription('The name of the document to retrieve')
				.setRequired(true)
				.addChoices(
					...easyListItems(Object.keys(fanmadeLinks)),
				),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		const choice = fanmadeLinks[interaction.options.getString('document')];
		await interaction.reply({ content: choice, flags: MessageFlags.Ephemeral });
	},
};
