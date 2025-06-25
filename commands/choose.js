const { SlashCommandBuilder } = require('discord.js');
const { rollWeighted } = require('../utils/dice');

const delimiters = ';/, ';
module.exports = {
	data: new SlashCommandBuilder()
		.setName('choose')
		.setDescription('Choose from a list of choices')
		.addStringOption(
			option =>
				option
					.setName('choices')
					.setDescription('What you\'re picking from')
					.setRequired(true),
		).addBooleanOption(
			option =>
				option
					.setName('secret')
					.setDescription('Wanna be sneaky?')
					.setRequired(false),
		).addIntegerOption(
			option =>
				option
					.setName('pick')
					.setDescription('How many choices?')
					.setRequired(false),
		),
	category: 'Utilities',
	async execute(interaction) {
		const choiceString = interaction.options.getString('choices');
		const secrecy = interaction.options.getBoolean('secret') ?? false;
		const pick = interaction.options.getInteger('pick') ?? 1;
		let choices;
		
		const displayList = [];
		const weightedChoices = {};
		let numberOfChoices = 0;
		let delimiter = null;
		for (const s in delimiters) {
			if (choiceString.indexOf(delimiters[s]) !== -1) {
				delimiter = delimiters[s]
				break;
			}
		}
		// If no delimiters exist, only one choice exists to select from
		// Sausage admonishes the user and returns
		if (!delimiter) {
			await interaction.reply({ content: 'dude.', ephemeral: true });
			return;
		}

		choices = choiceString.split(delimiter).map(x => x.trim());
		for (let i = 0; i < choices.length; i++) {
			const match = /: ?(\d+)/.exec(choices[i]);
			if (match) {
				const processedString = choices[i].substring(0, choices[i].length - match[0].length);
				displayList.push(`- \`${processedString}\` (${match[1]})`);
				const weight = parseInt(match[1]);
				weightedChoices[processedString] = weight;
				numberOfChoices += weight;
			} else {
				displayList.push(`- \`${choices[i]}\``);
				weightedChoices[choices[i]] = 1;
				numberOfChoices += 1;
			}
		}
		if (numberOfChoices <= pick) {
			await interaction.reply({ content: `You can't pick ${pick} choices from a list ${numberOfChoices} elements long.`, ephemeral: true });
			return;
		} else if (pick <= 0) {
			await interaction.reply({ content: `You can't pick ${pick} choices from a list.`, ephemeral: true });
		}

		const result = [];
		while (pick > result.length) {
			const select = rollWeighted(weightedChoices);
			result.push(select);
			weightedChoices[select] -= 1;
		}

		await interaction.reply({ content: `Choices: \n${displayList.join('\n')}\n\nChoice${ pick !== 1 ? 's' : '' } selected: \`${result.join(', ')}\``, ephemeral: secrecy });
	},
};