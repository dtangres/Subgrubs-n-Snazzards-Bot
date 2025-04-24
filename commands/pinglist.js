const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, ButtonBuilder, ButtonStyle, TextInputStyle } = require('discord.js');
const { getDefaultEmbed } = require('../utils/stringy');
const { fetchSQL } = require('../utils/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pinglist')
		.setDescription('Create and manage pinglists')
		.addStringOption(option =>
			option
				.setName('operation')
				.setDescription('What do you want to do?')
				.setRequired(true)
				.addChoices(
					{ name: 'create', value: 'create' },
					{ name: 'invoke', value: 'invoke' },
					{ name: 'bestow', value: 'bestow' },
					{ name: 'assess', value: 'assess' },
					{ name: 'rename', value: 'rename' },
					{ name: 'delete', value: 'delete' },

				),
		).addStringOption(option =>
			option
				.setName('name')
				.setDescription('Pinglist name')
				.setRequired(true),
		),
	category: 'Utilities',
	async execute(interaction) {
		const name = interaction.options.getString('name').replace(/[^ a-zA-Z0-9?]/g, '').toLowerCase();
		const operation = interaction.options.getString('operation');
		const user = interaction.user.id;
		const serverID = interaction.guild.id;
		let query, result;
		const buttonRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId(`pinglist_join_${name}_${serverID}`)
					.setLabel('Join Pinglist')
					.setEmoji('✅')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId(`pinglist_leave_${name}_${serverID}`)
					.setLabel('Leave Pinglist')
					.setEmoji('👋')
					.setStyle(ButtonStyle.Danger),
			);
		const pinglistMessageContents = [buttonRow];

		query = 'SELECT * FROM `pinglist` WHERE `snowflake` = ? AND `record` = \'author\' AND `name` = ? AND `serverID` = ?;';
		result = await fetchSQL(query, [user, name, serverID]);
		if (!result.length) {
			if (operation === 'create') {
				query = 'SELECT * FROM `pinglist` WHERE `name` = ? and `serverID` = ?';
				const queryResult = await fetchSQL(query, [name, serverID]);
				if (queryResult.length) {
					await interaction.reply({ content: 'Sorry, a pinglist under that name already exists on this server. Please select another name.\n(If this presents a major inconvenience, ping Meme.)', ephemeral: true });
				} else {
					query = 'INSERT INTO `pinglist` VALUES (?, \'author\', ?, ?)';
					await fetchSQL(query, [user, name, serverID]);
					await interaction.reply({ embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` **created**!`)], components: pinglistMessageContents });
				}
			} else {
				await interaction.reply({ content: `You don't seem to have a pinglist under the name '${name}' on this server! Check your spelling and try again.`, ephemeral: true });
			}
		} else if (operation === 'create') {
			await interaction.reply({ content: `It seems like you already have a pinglist named '${name}' on this server!`, ephemeral: true });
		} else if (operation === 'invoke') {
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?';
			result = await fetchSQL(query, [name, serverID]);
			const userList = result.map(x => `<@${x.snowflake}>`).join(' ');
			const announcement = `Ping by ${interaction.member.displayName}!`;
			await interaction.reply({ content: `${announcement}\n\n-# ${userList}`, embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` invoked!\n\nUsers pinged: \`${result.length}\``)], components: pinglistMessageContents });
		} else if (operation === 'assess') {
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?;';
			result = await fetchSQL(query, [name, serverID]);

			const userList = [];
			await interaction.guild.members.fetch();
			for (const i in result) {
				const userName = (await interaction.guild.members.fetch(result[i].snowflake)) ?? null;
				userList.push(userName !== null ? `- \`${userName.user.username}#${userName.user.discriminator}\`` : '- `UNKNOWN USER`');
			}
			const userNames = userList.map(x => x).join('\n');
			await interaction.reply({ content: `The following users are subscribed to the pinglist \`${name}\`:\n-# ${userNames}`, ephemeral: true });
		} else if (operation === 'rename') {
			const modal = new ModalBuilder()
				.setCustomId(`pinglist_rename_${name}_${user}_${serverID}`)
				.setTitle(`Rename pinglist ${name}`);
			modal.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder()
						.setCustomId(`pinglist_rename_newName_${name}_${user}_${serverID}`)
						.setLabel('Specify a new name for the pinglist')
						.setPlaceholder(name)
						.setStyle(TextInputStyle.Short)
						.setRequired(true),
				),
			);
			await interaction.showModal(modal);
		} else if (operation === 'bestow') {
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?';
			result = await fetchSQL(query, [name, serverID]);
			const announcement = `Ping by ${interaction.member.displayName}!`;
			await interaction.reply({ content: `${announcement}\n\n`, embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` bestowed!`)], components: pinglistMessageContents });
		} else {
			const modal = new ModalBuilder()
				.setCustomId(`pinglist_delete_${name}_${user}_${serverID}`)
				.setTitle(`Delete pinglist '${name}'`);
			modal.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder()
						.setCustomId(`pinglist_delete_confirm_${name}_${user}_${serverID}`)
						.setLabel('WARNING: IRREVOCABLE ACTION')
						.setPlaceholder(`Type '${name}' verbatim to confirm deletion`)
						.setStyle(TextInputStyle.Short)
						.setRequired(true),
				),
			);
			await interaction.showModal(modal);
		}
	},
};