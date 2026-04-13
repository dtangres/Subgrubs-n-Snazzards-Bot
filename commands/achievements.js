const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { getDefaultEmbed } = require('../utils/stringy');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('achievements')
		.setDescription('View achievements and list the ones people have')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('list')
				.setDescription('List someone else\'s achievements (or yours!)')
				.addUserOption((option) =>
					option
						.setName('target')
						.setDescription('Whose achievements do you want to view?')
						.setRequired(false),
				),

		).addSubcommand((subcommand) =>
			subcommand
				.setName('view')
				.setDescription('View details for an achievement')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Search by name')
						.setRequired(true),
				),
		),
	category: 'Fun',
	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'list') {
			const target = interaction.options.getUser('target') ?? interaction.member;
			const self_flag = target.id === interaction.user.id;
			const pronouns = self_flag ? 'You' : 'That player';
			const verb = self_flag ? 'don\'t' : 'doesn\'t';

			// Fetch achievements for player
			let query = 'SELECT `achievements` FROM `player` WHERE `snowflake` = ?';
			let queryResult = await fetchSQL(query, [target.id]);

			// If no achievements, display message (return)
			if (!queryResult || queryResult[0].achievements === '' || queryResult[0].achievements === null) {
				await interaction.reply({
					content: `${pronouns} ${verb} have any achievements!`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			// Map IDs to achievements, collect
			const achievements = queryResult[0].achievements.split(' ');
			query = 'SELECT `id`, `title`, `category` FROM `achievement`';

			// Populate achievements listing
			queryResult = await fetchSQL(query);
			const achievementMapping = {};
			queryResult.forEach(
				i => { achievementMapping[i.id] = { title: i.title, category: i.category }; },
			);
			const achievementGroups = {};
			console.log(achievementMapping);
			for (const ach of achievements) {
				console.log(ach, '/', achievementMapping[ach]);
				const entry = achievementMapping[ach];
				if (!(entry['category'] in achievementGroups)) {
					achievementGroups[entry.category] = [];
				}
				achievementGroups[entry.category].push(entry.title);
			}

			// Sort achievements by category and alphabetically, titles only
			const msgText = [];
			for (const group of Object.keys(achievementGroups).sort()) {
				msgText.push(`## ${group}`);
				console.log(group);
				console.log(achievementGroups[group]);
				for (const title of achievementGroups[group].sort()) {
					msgText.push(`- ${title}`);
				}
			}
			const embed = getDefaultEmbed()
				.setTitle(`Achievements for ${target.displayName}`)
				.setDescription(msgText.join('\n'));

			// If user not self, display ephemerally; otherwise display publically (return)
			if (self_flag) {
				await interaction.reply({
					embeds: [embed],
				});
			} else {
				await interaction.reply({
					embeds: [embed],
					flags: MessageFlags.Ephemeral,
				});
			}
		} else if (interaction.options.getSubcommand() === 'view') {
			const name = interaction.options.getString('name');

			// Search DB for substring, case insensitive
			const query = 'SELECT `title`, `notes` FROM `achievement` WHERE `title` LIKE ?';
			const queryResult = await fetchSQL(query, [`%${name}%`]);
			// If no matches, warn user (return)
			if (queryResult.length === 0) {
				await interaction.reply({
					content: `There don't seem to be any achievements by the name '${name}'. Please double-check your spelling and try again.`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			// If multiple matches, warn user (return)
			if (queryResult.length > 1) {
				const pleaseClarifyText = [
					`There are \`${queryResult.length}\` matches for the term '${name}':`,
					queryResult.map(x => `- \`${x.title}\``).join('\n'),
				].join('\n');
				await interaction.reply({
					content: pleaseClarifyText,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			// Format info from single match, display ephemerally (return)
			const embed = getDefaultEmbed()
				.setTitle(queryResult[0].title)
				.setDescription(queryResult[0].notes);
			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}
	},
};
