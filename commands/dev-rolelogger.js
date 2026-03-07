const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, LabelBuilder, MessageFlags } = require('discord.js');
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
			await interaction.reply({ content: `Nobody has the role '${targetRole.name}'.`, flags: MessageFlags.Ephemeral });
			return;
		}
		// Check if role exists in the database
		const query = 'SELECT `title`, `notes` FROM `achievement` WHERE `id` = ?';
		const result = (await fetchSQL(query, [targetRole.id]))[0];

		// If so, populate modal values with existing flavor/title text
		const modal = new ModalBuilder()
			.setCustomId(`roleLoggerModal_${targetRole.id}`)
			.setTitle(cutoffWithEllipsis(`Update Role Details: ${targetRole.name}`, 45));

		const titleBox = new TextInputBuilder()
			.setCustomId(`roleLoggerModal_title_${targetRole.id}`)
			.setPlaceholder(result === undefined ? 'Cool Dude' : result.title)
			.setValue(result === undefined ? targetRole.name : result.title)
			.setStyle(TextInputStyle.Short)
			.setMaxLength(64)
			.setRequired(true);

		const titleLabel = new LabelBuilder()
			.setLabel('Title')
			.setTextInputComponent(titleBox);

		const categoryMenu = new StringSelectMenuBuilder()
			.setCustomId(`roleLoggerModal_category_${targetRole.id}`)
			.setPlaceholder('Select Category')
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel('🎭 EVENT')
					.setDescription('Achievements granted for participation in events')
					.setValue('EVENT'),
				new StringSelectMenuOptionBuilder()
					.setLabel('📝 MEMORABILIA')
					.setDescription('Achievements for commemorating special occasions')
					.setValue('MEMORABILIA'),
				new StringSelectMenuOptionBuilder()
					.setLabel('🤫 SECRET')
					.setDescription('Achievements which are SECRET. SHHH!')
					.setValue('SECRET'),
			);
		const categoryLabel = new LabelBuilder()
			.setLabel('Category')
			.setStringSelectMenuComponent(categoryMenu);

		const notesBox = new TextInputBuilder()
			.setCustomId(`roleLoggerModal_notes_${targetRole.id}`)
			.setPlaceholder(result === undefined ? 'You\'re a cool dude!' : result.notes)
			.setValue(result === undefined ? '' : result.notes)
			.setStyle(TextInputStyle.Paragraph)
			.setMaxLength(64)
			.setRequired(true);

		const notesLabel = new LabelBuilder()
			.setLabel('Notes')
			.setDescription('These are visible to the user!')
			.setTextInputComponent(notesBox);

		modal.addLabelComponents(titleLabel, categoryLabel, notesLabel);
		// Open modal
		await interaction.showModal(modal);
	},
};

async function getRoleUsers(role) {
	return role.members.map(m => {
		return m.user.id;
	});
}