const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, MessageFlags } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { camelize, dictList } = require('../utils/stringy');
const { tableNames } = require('../utils/info');
require('dotenv').config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('patch')
		.setDescription('Perform live edits to the rules database')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a new entry to the database')
				.addStringOption(option =>
					option
						.setName('table')
						.setDescription('Table you want to add an entry to')
						.setRequired(true)
						.setChoices(
							...dictList(tableNames),
						),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('edit')
				.setDescription('Edit an existing entry in the database')
				.addStringOption(option =>
					option
						.setName('table')
						.setDescription('Table whose entry you want to edit')
						.setRequired(true)
						.setChoices(
							...dictList(tableNames),
						),
				).addStringOption(option =>
					option
						.setName('key')
						.setDescription('Key of entry you want to edit')
						.setRequired(true),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('drop')
				.setDescription('Remove an existing entry in the database')
				.addStringOption(option =>
					option
						.setName('table')
						.setDescription('Table whose entry you want to remove')
						.setRequired(true)
						.setChoices(
							...dictList(tableNames),
						),
				).addStringOption(option =>
					option
						.setName('key')
						.setDescription('Key of entry you want to remove')
						.setRequired(true),
				),
		).setDefaultMemberPermissions(0),
	async execute(interaction) {
		// Rejects attempt if user isn't in guild
		if (interaction.guildId !== process.env.GUILD_ID) {
			await interaction.reply({ content: 'Sorry, you can\'t use that command here.', flags: MessageFlags.Ephemeral });
		} else if (interaction.options.getSubcommand() === 'add') {
			const table = camelize(interaction.options.getString('table'));
			const query = 'SHOW COLUMNS FROM ??';
			const queryResult = await fetchSQL(query, [table]);

			const modal = new ModalBuilder()
				.setCustomId(`patchAddModal_${table}`)
				.setTitle(`Enter new entry for ${table}`);

			for (const item of queryResult) {
				const label = item['Field'];
				if (label === 'key') continue;
				const textBox = new TextInputBuilder()
					.setCustomId(`patchAddTextInput_${table}_${label}`)
					.setRequired(true);
				if (label === 'text') {
					textBox
						.setStyle(TextInputStyle.Paragraph)
						.setMinLength(0)
						.setMaxLength(4000);
				} else {
					textBox.setStyle(TextInputStyle.Short);
				}

				const textLabel = new LabelBuilder()
					.setLabel(`Enter ${label}`)
					.setTextInputComponent(textBox);

				modal.addLabelComponents(textLabel);
			}
			await interaction.showModal(modal);
		} else if (interaction.options.getSubcommand() === 'edit') {
			const table = camelize(interaction.options.getString('table'));
			const key = camelize(interaction.options.getString('key'));
			let query = 'SELECT 1 FROM ?? WHERE `key` = ?;';
			let queryResult = await fetchSQL(query, [table, key]);
			if (queryResult.length) {
				query = 'SHOW COLUMNS FROM ??';
				queryResult = await fetchSQL(query, [table]);
				const buttons = new ActionRowBuilder();
				for (const item of queryResult) {
					const label = item['Field'];
					if (label === 'key') continue;
					buttons.addComponents(
						new ButtonBuilder()
							.setCustomId(`patchEditButton_${table}_${key}_${label}`)
							.setLabel(label)
							.setStyle(ButtonStyle.Primary),
					);
				}
				await interaction.reply({ components: [buttons], flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: `Sorry, I couldn't find anything for key '${key}' in table '${table}'. Check your spelling and try again!`, flags: MessageFlags.Ephemeral });
			}
		} else if (interaction.options.getSubcommand() === 'drop') {
			const table = camelize(interaction.options.getString('table'));
			let key = camelize(interaction.options.getString('key'));
			const query = 'SELECT `key` FROM ?? WHERE `key` = ?;';
			const queryResult = await fetchSQL(query, [table, key]);
			if (queryResult.length) {
				key = queryResult[0]['key'];
				const modal = new ModalBuilder()
					.setCustomId(`patchDropModal_${table}_${key}`)
					.setTitle(`Delete ${table} : ${key}`);

				const textBox = new TextInputBuilder()
					.setCustomId(`patchDropTextInput_${table}_${key}`)
					.setPlaceholder(`Type '${key}' verbatim to confirm deletion`)
					.setStyle(TextInputStyle.Short)
					.setRequired(true);

				const textLabel = new LabelBuilder()
					.setLabel('CONFIRM DELETION')
					.setTextInputComponent(textBox);

				modal.addLabelComponents(textLabel);
				await interaction.showModal(modal);
			} else {
				await interaction.reply({ content: `Sorry, I couldn't find anything for key '${key}' in table '${table}'. Check your spelling and try again!`, flags: MessageFlags.Ephemeral });
			}
		}
	},
};