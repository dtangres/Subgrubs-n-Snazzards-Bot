const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { cutoffWithEllipsis } = require('../utils/stringy');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dev-rolelogger')
		.setDescription('<DEV COMMAND> log user role for later scraping')
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
		const query = 'SELECT `title`, `notes` FROM `achievement` WHERE `id` = ?';
		const result = (await fetchSQL(query, [targetRole.id]))[0];
		// If so, populate modal values with existing flavor/title text
		const titleRow = new ActionRowBuilder();
		const titleBox = new TextInputBuilder()
			.setCustomId(`roleScraperModal_title_${targetRole.id}`)
			.setLabel('Title')
			.setPlaceholder(result === undefined ? 'Cool Dude' : result.title)
			.setValue(result === undefined ? targetRole.name : result.title)
			.setStyle(TextInputStyle.Short)
			.setMaxLength(64)
			.setRequired(true);
		titleRow.addComponents(titleBox);
		const notesRow = new ActionRowBuilder();
		const notesBox = new TextInputBuilder()
			.setCustomId(`roleScraperModal_notes_${targetRole.id}`)
			.setLabel('Notes (these are visible to the user!)')
			.setPlaceholder(result === undefined ? 'You\'re a cool dude!' : result.notes)
			.setValue(result === undefined ? '' : result.notes)
			.setStyle(TextInputStyle.Paragraph)
			.setMaxLength(64)
			.setRequired(true);
		notesRow.addComponents(notesBox);
		const modal = new ModalBuilder()
			.setCustomId(`roleScraperModal_${targetRole.id}`)
			.setTitle(cutoffWithEllipsis(`Update Role Details: ${targetRole.name}`, 45))
			.addComponents(titleRow, notesRow);
		// Open modal
		await interaction.showModal(modal);
	},
};

async function getRoleUsers(role) {
	return role.members.map(m => {
		return m.user.id;
	});
}