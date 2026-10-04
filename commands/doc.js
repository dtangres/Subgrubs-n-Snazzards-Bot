const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fanmadeLinks, communityLinks, loreLinks, docDict, docPluralForms } = require('../utils/info');
const { easyListItems } = require('../utils/math');
const { getDefaultEmbed } = require('../utils/stringy');
const { getDocLink } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('doc')
		.setDescription('Retrieve fanmade resource')
		.addSubcommand(subcommand =>
			subcommand
				.setName('fanmade')
				.setDescription('View fanmade works for S2!')
				.addStringOption(option =>
					option.setName('document')
						.setDescription('The name of the document to retrieve')
						.setRequired(true)
						.addChoices(
							...easyListItems(Object.keys(fanmadeLinks)),
						),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('community')
				.setDescription('View community documents for S2 RP!')
				.addStringOption(option =>
					option.setName('document')
						.setDescription('The name of the document to retrieve')
						.setRequired(true)
						.addChoices(
							...easyListItems(Object.keys(communityLinks)),
						),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('lore')
				.setDescription('View lore documents for S2 RP!')
				.addStringOption(option =>
					option.setName('document')
						.setDescription('The name of the document to retrieve')
						.setRequired(true)
						.addChoices(
							...easyListItems(Object.keys(loreLinks)),
						),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('book')
				.setDescription('View the S2 manual!')
				.addStringOption(option =>
					option.setName('document')
						.setDescription('The name of the document to retrieve')
						.setRequired(false),
				),
		),

	category: 'Game Stuff',
	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'fanmade') {
			const choice = fanmadeLinks[interaction.options.getString('document')];
			await interaction.reply({ content: choice, flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'community') {
			const choice = communityLinks[interaction.options.getString('document')];
			await interaction.reply({ content: choice, flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'lore') {
			const choice = loreLinks[interaction.options.getString('document')];
			await interaction.reply({ content: choice, flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'book') {
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
		}

	},
};
