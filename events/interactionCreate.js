const { Events, GatewayRateLimitError, MessageFlags } = require('discord.js');
const { getCurrentTimestamp } = require('../utils/math');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			if (error instanceof GatewayRateLimitError) {
				const now = Math.ceil((getCurrentTimestamp() + error.data.retry_after * 1000) / 1000);
				const timestamp = `<t:${now}:R>`;
				await interaction.reply({
					content: `Sorry, you're being rate limited! Please retry ${timestamp}.`,
					flags: MessageFlags.Ephemeral,
				});
			} else {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
			}
		}
	},
};
