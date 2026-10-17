require('dotenv').config();
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { expToLevel, levelToExp } = require('../utils/info');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('View a user\'s server level')
		.addUserOption(option =>
			option
				.setName('username')
				.setDescription('Whose level do you want to view? (default: yours)')
				.setRequired(false),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		const target = interaction.options.getUser('username') ?? interaction.user;
		if (interaction.guildId !== process.env.GUILD_ID) {
			await interaction.reply({ content: 'Sorry, you can\'t use that command here.', flags: MessageFlags.Ephemeral });
		} else if (target.bot) {
			await interaction.reply({ content: 'Bots can\'t have levels, sorry.', flags: MessageFlags.Ephemeral });
		} else {
			const snowflake = target.id;
			const queryResult = await fetchSQL('SELECT `exp` FROM `player` WHERE `snowflake` = ?', [snowflake]);
			if (queryResult.length) {
				const exp = parseInt(queryResult[0]['exp']);
				const currentLevel = Math.floor(expToLevel(exp));
				const nextLevel = currentLevel + 1;
				const expDelta = exp - levelToExp(currentLevel);
				const nextLevelExp = levelToExp(nextLevel) - exp + expDelta;
				await interaction.reply({ content: `<@${snowflake}> is level **${currentLevel}** (${expDelta}/${nextLevelExp} to next)` });
			} else {
				await interaction.reply({ content: `<@${snowflake}> doesn't appear to have a level. Weird???`, flags: MessageFlags.Ephemeral });
			}

		}
	},
};