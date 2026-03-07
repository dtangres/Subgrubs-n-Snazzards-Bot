require('dotenv').config();
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getDefaultEmbed } = require('../utils/stringy');
const { fetchSQL } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('trollcall')
		.setDescription('Retrieve a user\'s troll call')
		.addUserOption(option =>
			option
				.setName('username')
				.setDescription('The name of the user whose troll call you want')
				.setRequired(false),
		).addBooleanOption(option =>
			option
				.setName('public')
				.setDescription('Post for everyone else (default: false)')),
	category: 'Game Stuff',
	async execute(interaction) {
		const username = interaction.options.getUser('username');
		if (username) {
			let public = interaction.options.getBoolean('public');
			if (public === undefined) public = false;
			const query = 'SELECT `docLink` FROM `trollcall` WHERE `userID`=?;';
			const queryResult = await fetchSQL(query, [username.id]);
			if (queryResult.length) {
				const docLink = queryResult[0].docLink;
				await interaction.reply({ content: docLink, ephemeral: !public });
			} else {
				console.log(`No information found for ${username}.`);
				const embed = new getDefaultEmbed()
					.setDescription(`Sorry, I couldn't find anything for '${username}'.`);
				await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
			}
		} else {
			await interaction.reply(`https://docs.google.com/spreadsheets/d/${process.env.TROLL_CALL_DOC_ID}/edit#gid=0`);
		}
	},
};