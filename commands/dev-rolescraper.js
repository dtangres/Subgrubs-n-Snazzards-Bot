const { SlashCommandBuilder } = require('discord.js');
const { fetchSQL } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dev-rolescraper')
		.setDescription('<DEV COMMAND> scrape users of a role and log to database')
		.addRoleOption((option) =>
			option
				.setName('role')
				.setDescription('Role to target')
				.setRequired(true),
		)
		.setDefaultMemberPermissions(0),
	category: 'DEVELOPER',
	async execute(interaction) {
		// Fetch current guild
		const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
		// Fetch roles
		await guild.roles.fetch();
		await guild.members.fetch();
		// Fetch specific role
		const targetRole = interaction.options.getRole('role');
		// Fetch role users
		const roleUsers = await getRoleUsers(targetRole);
		// Quit out if role user list is empty
		if (roleUsers.length === 0) {
			await interaction.reply({ content: `Nobody has the role '${targetRole.name}'.`, ephemeral: true });
			return;
		}
		// Check if role exists in the database
		let query = 'SELECT `title`, `notes` FROM `achievement` WHERE `id` = ?';
		const result = (await fetchSQL(query, [targetRole.id]))[0];
		let nonUpdatedUsers;
		if (result !== undefined) {
			query = 'SELECT `snowflake`, `achievements` FROM `player` WHERE (`achievements` NOT LIKE ? OR `achievements` IS NULL) AND `snowflake` IN (?)';
			nonUpdatedUsers = await fetchSQL(query, [`%${targetRole.id}%`, roleUsers]);
			for (const user of nonUpdatedUsers) {
				const { snowflake, achievements } = user;
				const updatedAchievements = `${achievements ?? ''}${achievements ? ' ' : ''}${targetRole.id}`;
				query = 'UPDATE `player` SET `achievements` = ? WHERE `snowflake` = ?';
				await fetchSQL(query, [updatedAchievements, snowflake]);
			}
		}
		await interaction.reply({ content: `${nonUpdatedUsers.length} rows updated; interaction complete.\n<@&${targetRole.id}> has been logged.\nPlease wait a minute or so before calling this command again to avoid rate-limiting.`, ephemeral: true });
		return;
	},
};

async function getRoleUsers(role) {
	return role.members.map(m => {
		return m.user.id;
	});
}