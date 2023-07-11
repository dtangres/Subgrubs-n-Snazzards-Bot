/* eslint-disable capitalized-comments */
const { SlashCommandBuilder } = require('discord.js');
const emojiRegex = require('emoji-regex');
const { getDefaultEmbed } = require('../utils/stringy');
const { makeRelativeTimestamp } = require('../utils/time');
const { zip } = require('../utils/math');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('poll')
		.setDescription('Set up a poll!')
		.addStringOption(option =>
			option.setName('title')
				.setDescription('What\'s the poll for?')
				.setRequired(true),
		).addStringOption(option =>
			option.setName('description')
				.setDescription('A little lore. As a treat')
				.setRequired(true),
		).addStringOption(option =>
			option.setName('choices')
				.setDescription('Add choices (ex. 🍎Apple; 🍌Banana)')
				.setRequired(true),
		).addIntegerOption(option =>
			option.setName('time')
				.setDescription('Enter poll duration')
				.addChoices(
					{ name: '1m', value: 1 },
					{ name: '10m', value: 10 },
					{ name: '30m', value: 30 },
					{ name: '1hr', value: 60 },
					{ name: '4hr', value: 240 },
					{ name: '24hr', value: 1440 },
				)
				.setRequired(true),
		),
	async execute(interaction) {
		// Setup
		const rawTime = interaction.options.getInteger('time') * 60 * 1000;
		const description = interaction.options.getString('description');
		const rawChoices = interaction.options.getString('choices');
		const title = interaction.options.getString('title');
		const channel = await interaction.client.channels.cache.get(interaction.channelId);
		const regex = emojiRegex();
		const matches = Array.from(rawChoices.matchAll(regex));
		const emoji = matches.map(x => x[0]);
		const choicesList = rawChoices.split(regex).slice(1).map(x => x.trim());
		const choices = zip(emoji, choicesList);

		// Initial message
		const waitEmbed = getDefaultEmbed()
			.setDescription('🐸💬 Please wait while I set up the poll...');

		// React population
		const message = await interaction.reply({ embeds: [waitEmbed], fetchReply: true });
		try {
			console.log(emoji);
			for (const i in emoji) {
				console.log(emoji[i]);
				await message.react(emoji[i]);
			}
		} catch (error) {
			console.log(`Fuck! I can't react!:  ${error}`);
		}
		const collectorFilter = (reaction, user) => {
			return !user.bot;
		};
		const whoReacted = {};
		const emojiCollector = message.createReactionCollector({ filter: collectorFilter, time: rawTime });
		emojiCollector.on('collect', (reaction, user) => {
			console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
			whoReacted[user.tag] = reaction.emoji.name;
		});
		emojiCollector.on('end', async (collected) => {
			console.log(`Collected ${collected.size} items.`);
			console.log(whoReacted);
			const reactCounts = {};
			let maxVotes = -1;
			for (const e of Object.values(whoReacted)) {
				reactCounts[e] = reactCounts[e] ? reactCounts[e] + 1 : 1;
				if (reactCounts[e] > maxVotes) {
					maxVotes = reactCounts[e];
				}
			}
			console.log(reactCounts, maxVotes);
			message.reactions.removeAll()
				.catch(error => console.error('Failed to clear reactions:', error));
			const resultEmbed = getDefaultEmbed()
				.setDescription(`# ${title}\nPoll closed!\n\n${description}\n\n${choices.map(x => `${(reactCounts[x[0]] ?? 0) === maxVotes ? '**' : ''}${x[0]} ${x[1]} (${reactCounts[x[0]] ?? 0} vote${(reactCounts[x[0]] ?? 0) === 1 ? '' : 's'})${(reactCounts[x[0]] ?? 0) === maxVotes ? '**' : ''}`).join('\n')}`);
			if (interaction.options.getInteger('time') < 15) {
				await interaction.editReply({ embeds: [resultEmbed] });
			} else {
				await message.delete();
				await channel.send({ embeds: [resultEmbed] });
			}
		});


		// Display actual poll
		const timestamp = await makeRelativeTimestamp(rawTime);
		const pollEmbed = getDefaultEmbed()
			.setDescription(`# ${title}\nEnding ${timestamp}.\n\n${description}\n\n${choices.map(x => `${x[0]} ${x[1]}`).join('\n')}`);
		await interaction.editReply({ embeds: [pollEmbed] });
	},
};