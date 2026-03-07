const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { docDict, docPluralForms } = require('../utils/info');
const { getDefaultEmbed } = require('../utils/stringy');
const { getDocLink } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('doc')
		.setDescription('Retrieve system document')
		.addStringOption(option =>
			option.setName('document')
				.setDescription('The name of the document to retrieve')
				.setRequired(false),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		const choice = (interaction.options.getString('document') ?? '').replace(' ', '_').toUpperCase();
		const embed = getDefaultEmbed();
		const validChoices = Object.keys(docDict).concat(Object.keys(docPluralForms));
		if (choice !== '') {
			if (validChoices.indexOf(choice) > -1) {
				const docLink = getDocLink(docDict[choice] ?? docDict[docPluralForms[choice]]);
				await interaction.reply({ content: docLink });
			} else {
				embed.setDescription(`Sorry, I couldn't find any documents matching \`${choice}\`. Check your spelling and try again.`);
				await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
			}
		} else {
			embed.setDescription(`Possible document names:\n\n${Object.keys(docDict).join(', ')}`);
			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}

	},
};
