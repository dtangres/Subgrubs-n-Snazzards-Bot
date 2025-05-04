const { SlashCommandBuilder } = require('discord.js');
const { getDefaultEmbed } = require('../utils/stringy');
const { fetchSQL } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pinglists')
		.setDescription('View all your pinglists in this server'),
	category: 'Utilities',
	async execute(interaction) {
		const user = interaction.user.id;
		const serverID = interaction.guild.id;
		const query = 'SELECT `name`, COUNT(*) AS `count` FROM `pinglist` WHERE `name` IN (SELECT `name` FROM `pinglist` WHERE `snowflake` = ? AND `record` = "owner" AND `serverID` = ?) AND `serverID` = ? GROUP BY `name`';
		const result = await fetchSQL(query, [user, serverID, serverID]);
		const embed = getDefaultEmbed();

		if (!result.length) {
			embed.setDescription('Looks like you don\'t have any pinglists in this server! You can make one using `/pinglist create name`!');
		} else {
			embed.setDescription('You have the following pinglists in this server:\n' + result.map(x => `- \`${x.name}\` (**${x.count - 1}** subscriber${(x.count - 1 === 1 ? '' : 's')})`).join('\n'));
		}
		interaction.reply({ embeds: [embed], ephemeral: true });
	},
};