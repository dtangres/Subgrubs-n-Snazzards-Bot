const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { trollFirstNameDict, trollFullNameDict, trollTitleDict } = require('../utils/db');
const { cleanDiacritics } = require('../utils/stringy');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('troll')
		.setDescription('Retrieve troll sheet')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the troll to retrieve')
				.setRequired(true),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		let name = cleanDiacritics(interaction.options.getString('name')).replace(/[^-'. 0-9a-zA-Z?]/, '').toLowerCase();
		console.log(name);
		if (name.indexOf('the ') === 0) {
			name = name.substring(4);
		}
		let reply = '';
		if (name.includes(' ')) {
			if (trollFullNameDict[name]) {
				reply = trollFullNameDict[name];
			} else if (trollTitleDict[name]) {
				reply = trollTitleDict[name];
			} else {
				reply = { content: `Sorry, I couldn't find anything for '${name}'.`, flags: MessageFlags.Ephemeral };
			}
		} else if (trollFirstNameDict[name]) {
			reply = trollFirstNameDict[name];
		} else {
			const anyMatches = Object.keys(trollTitleDict).filter(x => x.includes(name));
			if (anyMatches.length === 1) {
				reply = trollTitleDict[anyMatches[0]];
			} else if (anyMatches.length > 1) {
				const componentArray = [];
				for (let i = 0; i < Math.ceil(anyMatches.length / 5); i++) {
					const actionRow = new ActionRowBuilder();
					for (let j = 0; j < Math.min(5, anyMatches.length - (5 * i)); j++) {
						const adultName = anyMatches[i * 5 + j];
						actionRow.addComponents(new ButtonBuilder()
							.setLabel(adultName)
							.setStyle(ButtonStyle.Link)
							.setURL(trollTitleDict[adultName]),
						);
					}
					componentArray.push(actionRow);
				}
				reply = { content: `Please select your desired match for ${name} from the choices below:`, components: componentArray };
			} else {
				reply = { content: `Sorry, I couldn't find anything for '${name}'.`, flags: MessageFlags.Ephemeral };
			}
		}
		await interaction.reply(reply);
	},
};