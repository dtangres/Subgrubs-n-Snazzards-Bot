const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, ButtonBuilder, ButtonStyle, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const { getDefaultEmbed, cutoffWithEllipsis } = require('../utils/stringy');
const { fetchSQL } = require('../utils/db');
const { generateBase36String } = require('../utils/dice');

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
					{ name: 'huddle', value: 'huddle' },
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
		
		function makePinglistMessageContents(hash) {
			const buttonRow = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId(`pinglist_join_${hash}_${serverID}`)
						.setLabel('Join Pinglist')
						.setEmoji('✅')
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId(`pinglist_leave_${hash}_${serverID}`)
						.setLabel('Leave Pinglist')
						.setEmoji('👋')
						.setStyle(ButtonStyle.Danger),
				);
			const pinglistMessageContents = [buttonRow];
			return pinglistMessageContents
		}

		async function getHash(name, serverID) {
			let query = 'SELECT `snowflake` FROM `pinglist` WHERE `name` = ? AND `serverID` = ? and `record` = \'hash\''
			let result = await fetchSQL(query, [name, serverID]);
			let hash = result[0].snowflake
			console.log(hash)
			return hash
		}

		query = 'SELECT * FROM `pinglist` WHERE `snowflake` = ? AND `record` = \'owner\' AND `name` = ? AND `serverID` = ?;';
		result = await fetchSQL(query, [user, name, serverID]);
		if (!result.length) {
			if (operation === 'create') {
				query = 'SELECT * FROM `pinglist` WHERE `name` = ? and `serverID` = ?';
				const queryResult = await fetchSQL(query, [name, serverID]);
				if (queryResult.length) {
					await interaction.reply({ content: 'Sorry, a pinglist under that name already exists on this server. Please select another name.\n(If this presents a major inconvenience, ping Meme.)', ephemeral: true });
				} else {
					query = 'INSERT INTO `pinglist` VALUES (?, \'owner\', ?, ?)';
					await fetchSQL(query, [user, name, serverID]);
					let newHash = generateBase36String(8)
					query = 'INSERT INTO `pinglist` VALUES (?, \'hash\', ?, ?)';
					await fetchSQL(query, [newHash, name, serverID]);
					await interaction.reply({ embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` **created**!`)], components: makePinglistMessageContents(newHash) });
				}
			} else {
				await interaction.reply({ content: `You don't seem to have a pinglist under the name '${name}' on this server! Check your spelling and try again.`, ephemeral: true });
			}
		} else if (operation === 'create') {
			await interaction.reply({ content: `It seems like you already have a pinglist named '${name}' on this server!`, ephemeral: true });
		} else if (operation === 'invoke') {
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `name` = ? AND `serverID` = ? AND `record` != \'hash\'';
			result = await fetchSQL(query, [name, serverID]);
			hash = await getHash(name, serverID)
			const userList = result.map(x => `<@${x.snowflake}>`).join(' ');
			const announcement = `Ping by ${interaction.member.displayName}!`;
			await interaction.reply({ content: `${announcement}\n\n-# ${userList}`, embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` invoked!\n\nUsers pinged: \`${result.length}\``)], components: makePinglistMessageContents(hash) });
		} else if (operation === 'assess') {
			await interaction.guild.members.fetch();
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?;';
			result = await fetchSQL(query, [name, serverID]);

			const userList = [];
			const ownerList = [];
			// TODO BROTHER. YOU NEED TO OPTIMIZE THESE FETCHES

			for (const i in result) {
				const userName = (await interaction.guild.members.fetch(result[i].snowflake)) ?? null;
				userList.push(userName !== null ? `- \`${userName.user.username}#${userName.user.discriminator}\`` : '- `UNKNOWN USER`');
			}
			const userNames = userList.map(x => x).join('\n');

			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'owner\' AND `name` = ? AND `serverID` = ?;';
			result = await fetchSQL(query, [name, serverID]);
			for (const i in result) {
				const userName = (await interaction.guild.members.fetch(result[i].snowflake)) ?? null;
				ownerList.push(userName !== null ? `- \`${userName.user.username}#${userName.user.discriminator}\`` : '- `UNKNOWN USER`');
			}
			const ownerNames = ownerList.map(x => x).join('\n');
			await interaction.reply({ content: `The following users are subscribed to the pinglist \`${name}\`:\n ${userNames} \n\nThe following users own this list:\n ${ownerNames}`, ephemeral: true });
		} else if (operation === 'huddle') {
			hash = await getHash(name, serverID)
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?';
			result = await fetchSQL(query, [name, serverID]);
			if (result.length) {
				const modal = new ModalBuilder()
					.setCustomId(`pinglist_huddle_${name}_${user}_${serverID}`)
					.setTitle(`Select user for co-hosting your pinglist`);
				modal.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId(`pinglist_huddle_target_${hash}_${serverID}`)
							.setLabel('Paste in your target\'s snowflake')
							.setStyle(TextInputStyle.Short)
							.setRequired(true),
					)
				);
				await interaction.showModal(modal);
			} else {
				await interaction.reply({ content: 'There are no non-owner subscribers to grant ownership to!', ephemeral: true });
			}
		} else if (operation === 'rename') {
			hash = await getHash(name, serverID)
			const modal = new ModalBuilder()
				.setCustomId(`pinglist_rename_${hash}_${user}_${serverID}`)
				.setTitle(cutoffWithEllipsis(`Rename pinglist ${name}`, 45));
			modal.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder()
						.setCustomId(`pinglist_rename_newName_${hash}_${user}_${serverID}`)
						.setLabel('Specify a new name for the pinglist')
						.setPlaceholder(name)
						.setStyle(TextInputStyle.Short)
						.setMaxLength(32)
						.setRequired(true),
				),
			);
			await interaction.showModal(modal);
		} else if (operation === 'bestow') {
			hash = await getHash(name, serverID)
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'subscriber\' AND `name` = ? AND `serverID` = ?';
			result = await fetchSQL(query, [name, serverID]);
			const announcement = `Ping by ${interaction.member.displayName}!`;
			await interaction.reply({ content: `${announcement}\n\n`, embeds: [getDefaultEmbed().setDescription(`Pinglist \`${name}\` bestowed!`)], components: makePinglistMessageContents(hash) });
		} else if (operation === 'delete') {
			hash = await getHash(name, serverID)
			query = 'SELECT `snowflake` FROM `pinglist` WHERE `record` = \'owner\' AND `name` = ? AND `serverID` = ?';
			result = await fetchSQL(query, [name, serverID]);
			if (result.length === 1) {
				const modal = new ModalBuilder()
					.setCustomId(`pinglist_delete_${hash}_${user}_${serverID}`)
					.setTitle(`Delete pinglist '${name}'`);
				modal.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId(`pinglist_delete_confirm_${hash}_${user}_${serverID}`)
							.setLabel('WARNING: IRREVOCABLE ACTION')
							.setPlaceholder(`Type '${name}' verbatim to confirm deletion`)
							.setStyle(TextInputStyle.Short)
							.setRequired(true),
					),
				);
				await interaction.showModal(modal);
			} else {
				await interaction.reply({ content: `You can't delete a pinglist you're not the sole owner of.\nIf you don't want to be in this one anymore, use \`/pinglist bestow\` on it and click 'Leave Pinglist'.`, ephemeral: true });
			}
		}
	},
};