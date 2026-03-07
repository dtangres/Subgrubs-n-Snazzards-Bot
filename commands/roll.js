const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, MessageFlags } = require('discord.js');
const { getDefaultEmbed } = require('../utils/stringy');
const { formatRoll, modStr, getRollColor, formatRawRoll, getRollResultName } = require('../utils/dice');
const { colorDict } = require('../utils/info');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll some dice')
		.addStringOption(option =>
			option.setName('raw')
				.setDescription('Enter a manual diceroll'),
		).addIntegerOption(option =>
			option.setName('talent')
				.setDescription('Specify Talent (default normal)')
				.addChoices(
					{ name: 'normal 😐', value: 0 },
					{ name: 'talented 🙂', value: 1 },
					{ name: 'legendary 😃', value: 2 },
					{ name: 'inept 🙁', value: -1 },
					{ name: 'godawful 😧', value: -2 },
				),
		).addIntegerOption(option =>
			option.setName('modifier')
				.setDescription('Specify modifier (default: +0)'),
		).addStringOption(option =>
			option.setName('description')
				.setDescription('Flavor text for your roll'),
		).addIntegerOption(option =>
			option.setName('dice')
				.setDescription('🎲 FOR [METAGAMERS] ONLY 🎲')
				.addChoices(
					{ name: '2d8', value: 8 },
					{ name: '4d4', value: 4 },
					{ name: '1d16', value: 16 },
					{ name: '1d6+1d10', value: 10 },
					{ name: '8d2', value: 2 }),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		const raw = interaction.options.getString('raw');
		const description = interaction.options.getString('description') || 'Roll result';
		if (raw) {
			let m;
			const lie_regex = /lie/;
			const regex = /(\d+)?d(\d+)(?:k([lh])(\d+))?(?:([+-])(\d+))?/;
			if ((m = lie_regex.exec(raw)) !== null) {
				const descBox = new TextInputBuilder()
					.setCustomId('limeLieRoll_desc')
					.setPlaceholder('What\'s the roll for?')
					.setStyle(TextInputStyle.Short);
				const descLabel = new LabelBuilder()
					.setLabel('Description')
					.setDescription('What\'s the roll for?')
					.setTextInputComponent(descBox);
				const truthBox = new TextInputBuilder()
					.setCustomId('limeLieRoll_truth')
					.setLabel('Truth')
					.setPlaceholder('What\'d you roll?')
					.setStyle(TextInputStyle.Short)
					.setMaxLength(8)
					.setRequired(true);
				const truthLabel = new LabelBuilder()
					.setLabel('Truth')
					.setDescription('What\'d you *actually* roll?')
					.setTextInputComponent(truthBox);
				const lieBox = new TextInputBuilder()
					.setCustomId('limeLieRoll_lie')
					.setPlaceholder('What\'d you decide? (leave blank if no lying)')
					.setStyle(TextInputStyle.Short)
					.setMaxLength(8)
					.setRequired(false);
				const lieLabel = new LabelBuilder()
					.setLabel('Lie')
					.setDescription('What\'s the lie? (Leave blank if not lying)')
					.setTextInputComponent(lieBox);
				const modal = new ModalBuilder()
					.setCustomId('limeLieModal')
					.setTitle('Input lie details')
					.addLabelComponents(descLabel, truthLabel, lieLabel);
				await interaction.showModal(modal);
			} else if ((m = regex.exec(raw)) !== null) {
				const amt = +(m[1] ?? 1);
				const size = +m[2];
				const keeps = m[3] ? (m[3] === 'h' ? +m[4] : -m[4]) : 0;
				if (Math.abs(keeps) > amt) {
					await interaction.reply({ content: `I'm sorry! I couldn't parse the roll \`${raw}\` because you're trying to keep more dice than you're rolling. Please double-check your spelling and try again.`, flags: MessageFlags.Ephemeral });
					return;
				}
				if (m[3] && keeps === 0) {
					await interaction.reply({ content: '...Why are you keeping zero dice? Please try again.', flags: MessageFlags.Ephemeral });
					return;
				}
				const mod = m[5] ? eval(`${m[5]}${m[6]}`) : 0;
				const rollInfo = formatRawRoll(amt, size, keeps, mod);
				const embed = getDefaultEmbed()
					.setTitle(`🎲 **${description}**`)
					.addFields(
						{ name: 'Dice', value: raw, inline: true },
						{ name: 'Result', value: rollInfo.text, inline: true },
						{ name: 'Total', value: rollInfo.sum.toString(), inline: true },
					)
					.setColor(colorDict.GREY);
				await interaction.reply({ embeds: [embed] });
			} else {
				await interaction.reply({ content: `I'm sorry! I couldn't parse the roll \`${raw}\`. Please double-check your spelling and try again.`, flags: MessageFlags.Ephemeral });
			}
		} else {
			const dice = interaction.options.getInteger('dice') || 8;
			const modifier = interaction.options.getInteger('modifier') || 0;
			const talent = interaction.options.getInteger('talent') || 0;
			const talentName = ['godawful', 'inept', '', 'talented', 'legendary'];
			const metagamerModifier = (dice === 8) ? '' : ` [\`${{ 10: '1d6+1d10', 4: '4d4', 2: '8d2', 16: '1d16' }[dice]}\`]`;
			const diceString = (talent === 0 && modifier === 0 && dice === 8) ? 'Flat 2d8' : ` (${dice === 2 ? '' : talentName[talent + 2]}${(talent !== 0 && modifier !== 0) ? ' ' : ''}${dice === 2 ? '' : modStr(modifier)}${metagamerModifier})`;
			const rollInfo = formatRoll(dice, talent, modifier);
			const embed = getDefaultEmbed()
				.setTitle(`🎲 **${description}**`)
				// .setDescription(`${diceString}\n\n🎲 ${rollInfo.text}`)
				.addFields(
					{ name: 'Dice', value: diceString, inline: true },
					{ name: 'Result', value: rollInfo.text, inline: true },
					{ name: 'Total', value: rollInfo.sum.toString(), inline: true },
				)
				.setColor(getRollColor(rollInfo));
			if (dice === 8) {
				embed.addFields(
					{ name: 'Base Result', value: getRollResultName(rollInfo), inline: true },
				);
			}
			await interaction.reply({ embeds: [embed] });
		}
	},
};