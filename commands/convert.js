const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { round } = require('../utils/math');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('convert')
		.setDescription('Convert from sweeps to years')
		.addNumberOption(option =>
			option
				.setName('amount')
				.setDescription('How many?')
				.setRequired(true),
		).addStringOption(option =>
			option
				.setName('units')
				.setDescription('Sweeps or years?')
				.addChoices(
					{ name: 'sweeps', value: 'sweeps' },
					{ name: 'years', value: 'years' },
				).setRequired(true)),
	category: 'Utilities',
	async execute(interaction) {
		const amount = interaction.options.getNumber('amount');
		const units = interaction.options.getString('units');
		const result = round(units.valueOf() === 'years'.valueOf() ? amount / 2.16 : amount * 2.16, 2);
		const messageContent = `\`${amount}\` ${units} is approximately equal to ${result} ${units.valueOf() === 'years'.valueOf() ? 'sweeps' : 'years'}.`;
		await interaction.reply({ content: messageContent, flags: MessageFlags.Ephemeral });
	},
};