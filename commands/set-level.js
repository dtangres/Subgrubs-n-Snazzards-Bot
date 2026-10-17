const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { levelToExp, expToLevel } = require('../utils/info');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('dev-level')
		.setDescription('Adjust target level')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('set')
				.setDescription('Manually set new level for player')
				.addUserOption(option =>
					option
						.setName('target')
						.setDescription('Select user')
						.setRequired(true),
				).addIntegerOption(option =>
					option
						.setName('level')
						.setDescription('Select level to adjust player to')
						.setRequired(true),
				),

		).addSubcommand((subcommand) =>
			subcommand
				.setName('add')
				.setDescription('Add levels to player')
				.addUserOption(option =>
					option
						.setName('target')
						.setDescription('Select user')
						.setRequired(true),
				).addIntegerOption(option =>
					option
						.setName('level')
						.setDescription('Select level amount to add')
						.setRequired(true),
				),

		).setDefaultMemberPermissions(0),
	category: 'DEVELOPER',
	async execute(interaction) {
		const level = interaction.options.getInteger('level');
		const target = interaction.options.getUser('target').id;
		if (interaction.guildId !== process.env.GUILD_ID) {
			await interaction.reply({ content: 'Sorry, you can\'t use that command here.', flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'set') {
			// Calculate new EXP and adjust
			const newExp = levelToExp(level);
			await fetchSQL('UPDATE `player` SET `exp` = ? WHERE `snowflake` = ?', [newExp, target]);
			interaction.reply({ content: `Updated level of <@${target}> to ${level} (${newExp} exp)`, flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'add') {
			// Calculate new EXP and adjust
			const queryResult = await fetchSQL('SELECT `exp` FROM `player` WHERE `snowflake` = ?', [target]);
			const exp = queryResult[0]['exp'];
			const oldLevel = Math.floor(expToLevel(exp));
			const newLevel = oldLevel + level;
			const expDelta = exp - levelToExp(Math.floor(oldLevel));
			const newExp = levelToExp(newLevel) + expDelta;
			await fetchSQL('UPDATE `player` SET `exp` = ? WHERE `snowflake` = ?', [newExp, target]);
			interaction.reply({ content: `Added ${level} levels to <@${target}>, bringing them to level ${level} (${newExp} exp)`, flags: MessageFlags.Ephemeral });
		}
	},
};