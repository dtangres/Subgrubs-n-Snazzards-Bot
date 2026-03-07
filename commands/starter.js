const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } = require('discord.js');
const { fetchSQL } = require('../utils/db');
const { titleCase } = require('../utils/stringy');
const { starterTypes } = require('../utils/info');
const { easyListItems } = require('../utils/math');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('starter')
		.setDescription('Retrieve troll sheet')
		.addStringOption(option =>
			option.setName('option')
				.setDescription('Which operation do you want to perform?')
				.addChoices(
					...easyListItems(['intro', 'post', 'outro', 'add', 'edit', 'remove']),
				).setRequired(true),
		).addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the troll/kid/alias you want to retrieve')
				.setRequired(true),
		),
	category: 'Game Stuff',
	async execute(interaction) {
		const op = interaction.options.getString('option').replace(/[^ a-zA-Z?]/, '').toLowerCase();
		const name = interaction.options.getString('name').replace(/[^ a-zA-Z?]/, '').toLowerCase();
		// Security check
		const user = interaction.user.id;
		let query = 'SELECT * FROM `starter` WHERE `snowflake` = ? AND `name` = ?';
		let result = await fetchSQL(query, [user, name]);
		if (!result.length && op !== 'add') {
			await interaction.reply({ content: `Sorry, there doesn't seem to be anything in your name for '${name}'. Check your spelling and try again.`, ephemeral: true });
		} else if (['add', 'edit', 'remove'].indexOf(op) >= 0) {
			const idTemplate = `starter_${op}_${user}_${name}`;
			const modal = new ModalBuilder()
				.setCustomId(idTemplate)
				.setTitle(`${titleCase(op)} messages for ${titleCase(name)}`);
			if (op === 'add' || op === 'edit') {
				if (op === 'add') {
					query = 'SELECT `content` FROM `starter` WHERE `snowflake` = ? AND `name` = ?';
					result = await fetchSQL(query, [user, name]);
					if (result.length) {
						await interaction.reply({ content: `It seems you already have the alias '${name}'! Use \`/starter edit ${name}\` to change these messages instead.`, ephemeral: true });
						return;
					}
				}
				for (let i = 0; i < 3; i++) {
					query = 'SELECT `content` FROM `starter` WHERE `snowflake` = ? AND `name` = ? AND `type` = ?';
					let text = '';
					if (op === 'edit') {
						result = await fetchSQL(query, [user, name, starterTypes[i]]);
						text = result[0].content;
					}
					modal.addLabelComponents(
						new LabelBuilder()
							.setLabel(`${titleCase(starterTypes[i])} Text`)
							.setTextInputComponent(
								new TextInputBuilder()
									.setCustomId(`${idTemplate}_${starterTypes[i]}`)
									.setStyle(i % 2 ? TextInputStyle.Paragraph : TextInputStyle.Short)
									.setValue(text)
									.setRequired(true),
							),
					);
				}
				await interaction.showModal(modal);
			} else if (op === 'remove') {
				modal.addLabelComponents(
					new LabelBuilder()
						.setLabel('Cofnrim Deletion')
						.setDescription('WARNING: IRREVOCABLE ACTION')
						.setTextInputComponent(
							new TextInputBuilder()
								.setCustomId(`${idTemplate}_confirm`)
								.setPlaceholder(`Type '${titleCase(name)}' verbatim to confirm deletion`)
								.setStyle(TextInputStyle.Short)
								.setRequired(true),
						),
				);
				await interaction.showModal(modal);
			}
		} else {
			query = 'SELECT `content` FROM `starter` WHERE `snowflake` = ? AND `name` = ? AND `type` = ?';
			result = await fetchSQL(query, [user, name, op]);
			await interaction.reply({ content: `\`\`\`\n${result[0].content}\n\`\`\``, ephemeral: true });
		}
	},
};