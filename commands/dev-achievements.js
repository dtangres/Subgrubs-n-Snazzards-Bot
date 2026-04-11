const { SlashCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { cutoffWithEllipsis } = require('../utils/stringy');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dev-achievements')
		.setDescription('Developer commands for achievement management')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('grant')
				.setDescription('Grant a specific achievement to a user')
				.addStringOption((option) =>
					option
						.setName('selector')
						.setDescription('Name or ID or achievement to grant')
						.setRequired(true),
				).addUserOption((option) =>
					option
						.setName('target')
						.setDescription('Recipient of achievement')
						.setRequired(true),
				),

		).addSubcommand((subcommand) =>
			subcommand
				.setName('revoke')
				.setDescription('Revoke a specific achievement from a user')
				.addStringOption((option) =>
					option
						.setName('selector')
						.setDescription('Name or ID or achievement to revoke')
						.setRequired(true),
				).addUserOption((option) =>
					option
						.setName('target')
						.setDescription('Recipient of achievement')
						.setRequired(true),
				),

		).addSubcommand((subcommand) =>
			subcommand
				.setName('convert')
				.setDescription('Award all players with role with associated achievement')
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Role to award achievement for')
						.setRequired(true),
				),
		).addSubcommand((subcommand) =>
			subcommand
				.setName('establish')
				.setDescription('Convert a role into an achievement')
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Role to convert into an achievement')
						.setRequired(true),
				),
		).setDefaultMemberPermissions(0),
	category: 'DEVELOPER',
	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'grant') {
			const selector = interaction.options.getString('selector');
			const target = interaction.options.getUser('target').id;
			// Check for name/ID match
			let query = 'SELECT `title`, `id` FROM `achievement` WHERE `title` LIKE ? OR `id` = ?';
			let queryResult = await fetchSQL(query, [`%${selector}%`, selector]);
			// If no matches, inform caller (return)
			if (queryResult.length === 0) {
				await interaction.reply({
					content: `There don't seem to be any matches for selector \`${selector}\`. Please double-check your spelling and try again.`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			} else if (queryResult.length > 1) {
				// If multiple matches, inform caller (return)
				const matchesList = queryResult.map(x => `- \`${x.id}\` (${x.title})`).join('\n');
				await interaction.reply({
					content: `There are multiple matches for the selector \`${selector}\`. Please retry an ID from the list below:\n${matchesList}`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			} else {
				// Collect single match information
				const { title, id } = queryResult[0];
				// Collect user information
				query = 'SELECT `achievements` FROM `player` WHERE `snowflake` = ?';
				queryResult = await fetchSQL(query, [target]);
				// Check if user has achievement
				const unpacked = queryResult[0].achievements.split(' ');
				// If user has achievement, inform caller (return)
				if (unpacked.includes(id)) {
					await interaction.reply({
						content: `User <@${target}> already has the achievement '${title}' (\`${id}\`)!`,
						flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
					});
					return;
				}
				// Grant achievement and inform caller (return)
				const newAchievements = queryResult[0].achievements.trim() + ` ${id}`;
				query = 'UPDATE `player` SET `achievements` = ? WHERE `snowflake` = ?';
				await fetchSQL(query, [newAchievements, target]);
				await interaction.reply({
					content: `Successfully awarded '${title}' (\`${id}\`) to <@${target}>!`,
					flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
				});
				return;
			}
		} else if (interaction.options.getSubcommand() === 'revoke') {
			const selector = interaction.options.getString('selector');
			const target = interaction.options.getUser('target').id;
			// Check for name/ID match
			let query = 'SELECT `title`, `id` FROM `achievement` WHERE `title` LIKE ? OR `id` = ?';
			let queryResult = await fetchSQL(query, [`%${selector}%`, selector]);
			// If no matches, inform caller (return)
			if (queryResult.length === 0) {
				await interaction.reply({
					content: `There don't seem to be any matches for selector \`${selector}\`. Please double-check your spelling and try again.`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			} else if (queryResult.length > 1) {
				// If multiple matches, inform caller (return)
				const matchesList = queryResult.map(x => `- \`${x.id}\` (${x.title})`).join('\n');
				await interaction.reply({
					content: `There are multiple matches for the selector \`${selector}\`. Please retry an ID from the list below:\n${matchesList}`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			} else {
				// Collect single match information
				const { title, id } = queryResult[0];
				// Collect user information
				query = 'SELECT `achievements` FROM `player` WHERE `snowflake` = ?';
				queryResult = await fetchSQL(query, [target]);
				// Check if user doesn't have achievement
				const unpacked = queryResult[0].achievements.split(' ');
				// If user does not have achievement, inform caller (return)
				if (!unpacked.includes(id)) {
					await interaction.reply({
						content: `User <@${target}> doesn't have the achievement '${title}' (\`${id}\`)!`,
						flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
					});
					return;
				}
				// Show the revocation modal
				const modal = new ModalBuilder()
					.setCustomId(`achievementRevokeModal_${target}_${id}`)
					.setTitle('Revoke Achievement Confirmation');

				const confirmBox = new TextInputBuilder()
					.setCustomId('achievementRevoke_confirm')
					.setPlaceholder(`Revoke '${title}' from ${interaction.options.getUser('target').displayName}`)
					.setStyle(TextInputStyle.Short)
					.setMaxLength(64)
					.setRequired(true);

				const confirmLabel = new LabelBuilder()
					.setLabel(`Enter '${id}'`)
					.setTextInputComponent(confirmBox);

				modal.addLabelComponents(confirmLabel);

				await interaction.showModal(modal);
			}
		} else if (interaction.options.getSubcommand() === 'convert') {
			const courtesyRateLimitWarning = '\nPlease wait 30 seconds between invocations of this command to avoid rate-limiting.';
			// Fetch current guild
			const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
			// Fetch roles
			await guild.roles.fetch();
			await guild.members.fetch();
			// Fetch specific role
			const targetRole = interaction.options.getRole('role');
			// Fetch role users
			const roleUsers = guild.roles.cache.get(targetRole.id).members.map(m => m.user.id);
			console.log(roleUsers);
			// Quit out if role user list is empty
			if (roleUsers.length === 0) {
				await interaction.reply({ content: `Nobody has the role '${targetRole.name}'.`, flags: MessageFlags.Ephemeral });
				return;
			}
			await addNewUsers(roleUsers);
			// Add any users who aren't in the player database
			// Check if role achievement exists in the database
			let query = 'SELECT `title`, `notes` FROM `achievement` WHERE `id` = ?';
			const queryResult = await fetchSQL(query, [targetRole.id]);
			// If it doesn't, warn caller and return
			if (queryResult.length === 0) {
				await interaction.reply({
					content: `No achievement associated with role ${targetRole.name}. Use \`/establish\` to create the entry.`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			// Enumerate all users who don't have the achievement
			query = 'SELECT `snowflake`, `achievements` FROM `player` WHERE (`achievements` NOT LIKE ? OR `achievements` IS NULL) AND `snowflake` IN (?)';
			const nonUpdatedUsers = await fetchSQL(query, [`%${targetRole.id}%`, roleUsers]);
			// If that's no one, warn the caller and exit
			if (nonUpdatedUsers.length === 0) {
				await interaction.reply({
					content: `There's no one with this role who still needs the achievement.${courtesyRateLimitWarning}`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			// Number the users who do have it
			query = 'SELECT `snowflake`, `achievements` FROM `player` WHERE (`achievements` LIKE ?) AND `snowflake` IN (?)';
			const updatedUsersLength = (await fetchSQL(query, [`%${targetRole.id}%`, roleUsers])).length;
			const totalUsers = updatedUsersLength + nonUpdatedUsers.length;
			query = 'UPDATE `player` SET `achievements` = CONCAT_WS(" ", `achievements`, ?) WHERE `snowflake` IN ? ';
			await fetchSQL(query, [targetRole.id, [nonUpdatedUsers.map(x => x.snowflake)]]);
			await interaction.reply({
				content: `${nonUpdatedUsers.length} users updated with achievement '${queryResult[0].title}' (Total users: ${totalUsers}).${courtesyRateLimitWarning}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		} else if (interaction.options.getSubcommand() === 'establish') {
			// Fetch current guild
			const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
			// Fetch roles
			await guild.roles.fetch();
			// Fetch specific role
			const targetRole = interaction.options.getRole('role');
			// Fetch role users
			const roleUsers = guild.roles.cache.get(targetRole.id).members.map(m => m.user.id);
			console.log(roleUsers);
			// Quit out if role user list is empty
			if (roleUsers.length === 0) {
				await interaction.reply({ content: `Nobody has the role '${targetRole.name}'.`, flags: MessageFlags.Ephemeral });
				return;
			}
			// Add any users who aren't in the player database
			await addNewUsers(roleUsers);
			// Check if role exists in the database
			const query = 'SELECT `title`, `notes` FROM `achievement` WHERE `id` = ?';
			const result = (await fetchSQL(query, [targetRole.id]))[0];

			// If so, populate modal values with existing flavor/title text
			const modal = new ModalBuilder()
				.setCustomId(`roleLoggerModal_${targetRole.id} `)
				.setTitle(cutoffWithEllipsis(`Update Role Details: ${targetRole.name} `, 45));

			const titleBox = new TextInputBuilder()
				.setCustomId(`roleLoggerModal_title_${targetRole.id} `)
				.setPlaceholder(result === undefined ? 'Cool Dude' : result.title)
				.setValue(result === undefined ? targetRole.name : result.title)
				.setStyle(TextInputStyle.Short)
				.setMaxLength(64)
				.setRequired(true);

			const titleLabel = new LabelBuilder()
				.setLabel('Title')
				.setTextInputComponent(titleBox);

			const categoryMenu = new StringSelectMenuBuilder()
				.setCustomId(`roleLoggerModal_category_${targetRole.id} `)
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
				.setCustomId(`roleLoggerModal_notes_${targetRole.id} `)
				.setPlaceholder(result === undefined ? 'You\'re a cool dude!' : result.notes)
				.setValue(result === undefined ? '' : result.notes)
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(2000)
				.setRequired(true);

			const notesLabel = new LabelBuilder()
				.setLabel('Notes')
				.setDescription('These are visible to the user!')
				.setTextInputComponent(notesBox);

			modal.addLabelComponents(titleLabel, categoryLabel, notesLabel);
			// Open modal
			await interaction.showModal(modal);
		}
	},
};

async function addNewUsers(roleUsers) {
	// Select all IDs which do NOT have entries in the player database right now
	let query = 'SELECT `snowflake` FROM `player`';
	const result = (await fetchSQL(query, [])).map(x => x['snowflake']);
	const missingUsers = new Set(roleUsers).difference(new Set(result));
	// Add missing entries
	if (missingUsers.size > 0) {
		query = `INSERT INTO \`player\` (\`snowflake\`) VALUES ${[...missingUsers].map(() => '(?)').join(', ')}`;
		await fetchSQL(query, [...missingUsers]);
	}
}