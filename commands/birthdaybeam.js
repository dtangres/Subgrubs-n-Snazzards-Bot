const { SlashCommandBuilder } = require('discord.js');
const { birthdays, birthdayBeamTime } = require('../utils/info');
const { fetchSQL } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('birthdaybeam')
		.setDescription('Woe. Cake be upon your target')
		.addUserOption(option =>
			option
				.setName('target')
				.setDescription('Who\'s it gonna be?')
				.setRequired(true),
		),
	category: 'Fun',
	async execute(interaction) {
		const nowMS = Date.now();
		let query = await fetchSQL(
			'SELECT `lastBirthdayBeam` FROM `player` WHERE `snowflake` = ?', [interaction.user.id],
		);
		const lastBirthdayBeam = query[0] ?? 0;
		if (nowMS - lastBirthdayBeam < 28_800_000) {
			await interaction.reply('You\'ve already beamed somebody in the past 8 hours! Try again later.');
		} else {
			const target = interaction.options.getUser('target');
			birthdays.push(target.id);
			setTimeout(() => {
				const index = birthdays.indexOf(target.id);
				if (index > -1) { birthdays.splice(index, 1); }
			}, birthdayBeamTime);
			query = await fetchSQL(
				'SELECT `lastBirthdayBeamed` FROM `player` WHERE `snowflake` = ?', [target.id],
			);
			const lastBirthdayBeamed = query[0] ?? 0;
			if (nowMS - lastBirthdayBeamed > birthdayBeamTime) {
				await fetchSQL(
					'UPDATE `player` SET `lastBirthdayBeam` = ? WHERE `snowflake` = ?', [nowMS, interaction.user.id],
				);
				await fetchSQL(
					'UPDATE `player` SET `lastBirthdayBeamed` = ? WHERE `snowflake` = ?', [nowMS, target.id],
				);
			}
			await interaction.reply(`\`${target.username}#${target.discriminator}\` has been **birthday beamed**! Bring on the 🍰 reacts!`);
		}
	},
};
