const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getDefaultEmbed } = require('../utils/stringy');
// Const { helpText } = require('../utils/info');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Read the command documentation!'),
	category: 'Misc.',
	async execute(interaction) {
		const helpTextArr = [];
		const categoryDict = {};
		interaction.client.commands.forEach(element => {
			const category = element.category;
			if (category) {
				if (!(category in categoryDict)) {
					categoryDict[category] = [];
				}
				categoryDict[category].push(element);
			}
		});
		const commandDict = {};
		const commands = await interaction.client.application.commands.fetch();
		commands.forEach(element => {
			commandDict[element.name] = { id: element.id, desc: element.description };
		});
		const helpList = Object.keys(categoryDict).filter(x => !x.toLowerCase().includes('dev'));
		helpList.sort();
		helpList.forEach(element => {
			helpTextArr.push(`### ${element}`);
			const commandList = categoryDict[element];
			commandList.forEach(cmd => {
				const name = cmd.data.name;
				helpTextArr.push(`- </${name}:${commandDict[name].id}> : ${commandDict[name].desc}`);
				commandDict[cmd.data.name];
			});
		});

		const returnEmbed = getDefaultEmbed()
			.setDescription(helpTextArr.join('\n'))
			.setTitle('Command Help');
		await interaction.reply({ embeds: [returnEmbed], flags: MessageFlags.Ephemeral });
	},
};