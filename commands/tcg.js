/* eslint-disable capitalized-comments */
const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getRandomCard, handlePlayerReward, postCard, fetchBinder, getPrettyBinderSummary, addCard, removeCard, pushBinder, checkSessionConflict, SessionStatus, makeNewBinder, isEmptyBinder, isEmptySet, getCardData, validateBinder } = require('../utils/cards');
const { parseInt64, toString64, getCurrentTimestamp, clamp, objectToListMap } = require('../utils/math');
const { cardSetList, currentPool, visibleCardSetList, setTranslate, cardTranslate, tradingOn, droppingCards, cardDropWaitTime, dailyBlocker } = require('../utils/info');
const { getDefaultEmbed } = require('../utils/stringy');
const { cardTradeSessions, fetchSQL } = require('../utils/db');
const { easyListItems } = require('../utils/math');
const { generateBase36String } = require('../utils/dice');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tcg')
		.setDescription('Trading Card Game Command Suite')
		.addSubcommand(subcommand =>
			subcommand
				.setName('binder')
				.setDescription('View your card collection - or someone else\'s')
				.addStringOption(option =>
					option
						.setName('set')
						.setDescription('Which set do you want to view? (Leave blank for all holdings)')
						.setRequired(false)
						.addChoices(
							...easyListItems(cardSetList),
						),
				).addUserOption(option =>
					option
						.setName('target')
						.setDescription('Select a user whose binder you want to view')
						.setRequired(false),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('visibility')
				.setDescription('Set your binder visibility')
				.addBooleanOption(option =>
					option
						.setName('value')
						.setDescription('Set your binder visibility. Leave blank to view your visibility.')
						.setRequired(false),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('card')
				.setDescription('View a particular card')
				.addStringOption(option =>
					option
						.setName('set')
						.setDescription('Which set do you want to pick from?')
						.setChoices(...easyListItems(cardSetList))
						.setRequired(true),
				).addStringOption(option =>
					option
						.setName('name')
						.setDescription('Which card do you want to see?')
						.setRequired(true),
				),
		).addSubcommand(subcommand =>
			subcommand
				.setName('daily')
				.setDescription('Claim a daily bonus card!'),

		).addSubcommand(subcommand =>
			subcommand
				.setName('trade')
				.setDescription('Trade cards with another user')
				.addUserOption(option =>
					option
						.setName('player')
						.setDescription('Who would you like to trade with?')
						.setRequired(true),
				),
		),
	category: 'Fun',
	async execute(interaction) {
		// Rejects attempt if user isn't in guild
		if (interaction.guildId !== process.env.GUILD_ID) {
			await interaction.reply({ content: 'Sorry, you can\'t use that command here.', ephemeral: true });
		} else {
		// Player wants to see their binder contents
			const cardSet = interaction.options.getString('set');
			if (interaction.options.getSubcommand() === 'daily') {
				if (!droppingCards) {
					await interaction.reply({ content: 'No dailies are available to claim. Check again when there\'s an event!', ephemeral: true });
					return;
				}
				const today = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }).split(' ')[0].slice(0, -1).split('/');
				// operate Regex to this
				// 10/13/2023
				const [month, day, year] = today.map(num => parseInt(num, 10));
				const query = await fetchSQL(
					'SELECT EXTRACT(YEAR FROM `last_daily`) AS `last_year`, \
				 EXTRACT(MONTH FROM `last_daily`) as `last_month`, \
				 EXTRACT(DAY FROM `last_daily`) as `last_day`, \
				 `last_drop` \
				 FROM `player` WHERE `snowflake` = ?', [interaction.user.id],
				);


				let isEligibleDay = true;
				let isEligibleBlocker = true;
				const nowMS = Date.now();
				if (query.length > 0) {
					const { last_year, last_month, last_day, last_drop } = query[0];
					isEligibleDay = !(last_year === year && last_month === month && last_day === day);
					let lastDropTime = parseInt(last_drop);
					lastDropTime = isNaN(lastDropTime) ? 0 : lastDropTime;
					isEligibleBlocker = (nowMS - lastDropTime) >= cardDropWaitTime;
				}

				if (isEligibleDay && isEligibleBlocker) {
					const { name, set, desc, spoiler } = await getRandomCard(currentPool);
					const guild = await interaction.client.guilds.cache.get(process.env.GUILD_ID);
					const botherChannel = await guild.channels.cache.get(process.env.BOTHER_CHANNEL);
					await botherChannel.send(await postCard({ set: set, name: name, desc: desc, content: `<@${interaction.user.id}>`, title: `Here's your drop for the day, \`${interaction.user.username}\`!`, spoiler: spoiler }));
					await handlePlayerReward(interaction.user.id, set, name);
					await fetchSQL('UPDATE `player` SET `last_daily` = ? WHERE `snowflake` = ?', [`${year}-${month}-${day}`, interaction.user.id]);
					await interaction.reply({ content: 'You picked up your daily!', ephemeral: true });
				} else if (!isEligibleDay) {
					await interaction.reply({ content: 'Your next daily is available tomorrow!', ephemeral: true });
				} else {
					await interaction.reply({ content: `You've already obtained a random card drop within the last \`${dailyBlocker / 60 / 60 / 1000}\` hours!`, ephemeral: true });
				}

			} else if (interaction.options.getSubcommand() === 'binder') {
				let target = interaction.options.getUser('target');
				if (target === null) target = interaction.user;
				if (target.bot) {
					await interaction.reply({ content: 'Bots don\'t trade cards! There\'s nothing here for you.', ephemeral: true });
				} else {
					const queryResult = await fetchSQL('SELECT `binder` FROM `player` WHERE `snowflake` = ?', [target.id]);
					if (!queryResult.length) {
						await interaction.reply({ content: 'You don\'t have a binder yet! Please wait while I set one up for you.', ephemeral: true });
						await pushBinder(target.id);
					} else {
						const isBinderViewable = await fetchSQL('SELECT `binderViewable` FROM `player` WHERE `snowflake` = ?', [target.id]);
						if (target === interaction.user || isBinderViewable[0].binderViewable) {
							const binder = await fetchBinder(target.id);
							const set = interaction.options.getString('set') ?? 'all';
							const summary = await getPrettyBinderSummary(binder, set);
							const embed = getDefaultEmbed()
								.setTitle(`\`${target.username}\`'s Binder Contents`)
								.setDescription(summary);
							await interaction.reply({ embeds: [embed], ephemeral: true });
						} else {
							await interaction.reply({ content: 'Sorry, this user\'s binder is private!', ephemeral: true });
						}
					}
				}
			} else if (interaction.options.getSubcommand() === 'visibility') {
				const value = interaction.options.getBoolean('value');
				if (value === undefined) {
					const visibility = await fetchSQL('SELECT `binderViewable` FROM `player` WHERE `snowflake` = ?', [interaction.user.id]);
					const message = `Your binder is currently ${visibility[0].binderViewable ? '' : 'not '}visible to others.`;
					await interaction.reply({ content: message, ephemeral: true });
				} else {
					await fetchSQL('UPDATE `player` SET `binderViewable` = ? WHERE `snowflake` = ?', [+value, interaction.user.id]);
					const message = `Your binder visibility has been set to ${value ? 'on' : 'off'}`;
					await interaction.reply({ content: message, ephemeral: true });
				}
				// Dev wants to view a particular card
			} else if (interaction.options.getSubcommand() === 'card') {
				await interaction.deferReply();
				const name = interaction.options.getString('name');
				try {
					const desc = await getCardData(cardSet).card_info.cards[name].description;
					const spoiler = await getCardData(cardSet).card_info.cards[name].spoiler;
					await interaction.editReply(await postCard({ set: cardSet, name: name, desc: desc, spoiler: spoiler }));
				} catch (err) {
					console.log(err);
					const reply = getDefaultEmbed().setDescription(`Sorry, I can't seem to find the card \`${cardSet}:${name}\`. Check your spelling and try again.`);
					await interaction.editReply({ embeds: [reply] });
				}
				// Player wants to trade with someone else
			} else if (interaction.options.getSubcommand() === 'trade') {
				if (!tradingOn) {
					await interaction.reply({ content: 'No event is being hosted currently. Try again another time!', ephemeral: true });
					return;
				}
				await interaction.deferReply();
				const targetPlayer = interaction.options.getUser('player');
				const initiatingPlayer = interaction.user;
				// No trades with bots
				if (targetPlayer.bot) {
					await interaction.editReply({ content: 'You can\'t trade with bots!', ephemeral: true });
					return;
				}
				if (targetPlayer.id === initiatingPlayer.id) {
					await interaction.editReply({ content: 'You can\'t trade with yourself!', ephemeral: true });
					return;
				}

				// Block new sessions where either participant is busy
				const sessionInfo = checkSessionConflict(initiatingPlayer, targetPlayer);
				if (sessionInfo === SessionStatus.InitiatorBusy) {
					await interaction.editReply({ content: 'You\'re already busy with another trade!', ephemeral: true });
					return;
				}
				if (sessionInfo === SessionStatus.TargetBusy) {
					await interaction.editReply({ content: 'Your target trade partner is currently busy trading with someone else!', ephemeral: true });
					return;
				}
				// Collect information
				let isDefault;
				let focusInitiator, focusTarget, focusSet;

				// Initialize session details
				const now = getCurrentTimestamp();
				const sessionID = generateBase36String(16);

				// Begin constructing embed, buttons
				const embed = getDefaultEmbed()
					.setTitle('⚠️ TRADE OFFER ⚠️')
					.setDescription('Configure your trade with the widgets below!');
				/*
				Because of the way Discord's API works, string select menus don't persist
				between clicks by default. Each time an option is selected, the select box's
				default option must be changed. This confers the illusion of a persistent menu.
			*/

				const setSelect = new StringSelectMenuBuilder()
					.setCustomId(`binder_trade_${sessionID}_system_set`);
				isDefault = true;
				for (const set of cardSetList) {
					setSelect.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel(setTranslate[set])
							.setValue(set)
							.setDefault(isDefault),
					);
					focusSet = isDefault ? set : focusSet;
					isDefault = isDefault && false;
				}
				const setSelectRow = new ActionRowBuilder()
					.addComponents(setSelect);

				// ========
				// Setup for dealmaker's side
				// ========
				// Binder collection / outgoing select menu
				const yourCardSelect = new StringSelectMenuBuilder()
					.setCustomId(`binder_trade_${sessionID}_initiator_select`);
				// Binder collection / outgoing select menu
				const yourBinder = await fetchBinder(initiatingPlayer.id);
				await validateBinder(yourBinder);
				const initiatorHasCards = !isEmptyBinder(yourBinder);
				isDefault = true;
				for (const card in initiatorHasCards ? yourBinder[focusSet] : { 'No cards!': 0 }) {
					yourCardSelect.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel((isDefault ? '➡️ ' : '') + cardTranslate[card])
							.setValue(card)
							.setDefault(isDefault),
					);
					// No if statement here.
					// Optimization to prevent incorrect branching at machine level
					// TODO does this actually make a difference?
					focusInitiator = isDefault ? card : focusInitiator;
					isDefault = isDefault && false;
				}

				// Up/Down buttons
				const yourUpButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_initiator_up`)
					.setEmoji('⬆️')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(!(initiatorHasCards && yourBinder[focusSet][focusInitiator] > 0));
				const yourDownButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_initiator_down`)
					.setEmoji('⬇️')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true);

				// Adding components to rows
				const yourCardSelectRow = new ActionRowBuilder()
					.addComponents(yourCardSelect);
				const yourCardSelectArrowRow = new ActionRowBuilder()
					.addComponents(yourUpButton, yourDownButton);

				// ========
				// Setup for target's side
				// ========

				// Binder collection / incoming select menu
				const theirCardSelect = new StringSelectMenuBuilder()
					.setCustomId(`binder_trade_${sessionID}_target_select`);
				const theirBinder = await fetchBinder(targetPlayer.id);
				await validateBinder(theirBinder);
				const targetHasCards = !isEmptyBinder(theirBinder);
				isDefault = true;
				for (const card in targetHasCards ? theirBinder[focusSet] : { 'No cards!': 0 }) {
					theirCardSelect.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel((isDefault ? '⬅️ ' : '') + cardTranslate[card])
							.setValue(card)
							.setDefault(isDefault),
					);
					focusTarget = isDefault ? card : focusTarget;
					isDefault = isDefault && false;
				}

				// Up/Down buttons
				const theirUpButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_target_up`)
					.setEmoji('⬆️')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(!(targetHasCards && theirBinder[focusSet][focusTarget] > 0));
				const theirDownButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_target_down`)
					.setEmoji('⬇️')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true);

				// Adding components to rows
				const theirCardSelectRow = new ActionRowBuilder()
					.addComponents(theirCardSelect);
				const theirCardSelectArrowRow = new ActionRowBuilder()
					.addComponents(theirUpButton, theirDownButton);

				// Confirm and cancel buttons
				const confirmButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_system_confirm`)
					.setEmoji('✅')
					.setStyle(ButtonStyle.Success)
					.setDisabled(true);
				const cancelButton = new ButtonBuilder()
					.setCustomId(`binder_trade_${sessionID}_system_cancel`)
					.setEmoji('🗑️')
					.setStyle(ButtonStyle.Danger);

				// Adding buttons to different rows
				yourCardSelectArrowRow.addComponents(cancelButton);
				theirCardSelectArrowRow.addComponents(confirmButton);

				// Push session to global session tracker
				cardTradeSessions[sessionID] = { offer: await makeNewBinder(), payment: await makeNewBinder(), setFocus: focusSet, initiator: initiatingPlayer.id, target: targetPlayer.id, initiatorFocus: focusInitiator, targetFocus: focusTarget, closing: false };
				// Respond to player command with embed
				// TODO Defer reply
				const response = await interaction.editReply({ embeds: [embed], components: [setSelectRow, yourCardSelectRow, yourCardSelectArrowRow, theirCardSelectRow, theirCardSelectArrowRow] });

				// ========
				// Set up collectors
				// ========
				const tradeExpiryTime = 600_000;
				const buttonCollector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: tradeExpiryTime });
				buttonCollector.on('collect', async buttonInteraction => {
					const [, , bSession, bTrader, bDirection] = buttonInteraction.customId.split('_');
					const bSet = cardTradeSessions[bSession]['setFocus'];
					// Most interactions are available only to the calling user
					if (buttonInteraction.user.id === initiatingPlayer.id) {
						if (!cardTradeSessions[bSession]) {
						// TODO test if this message actually plays after a reboot
							response.edit({ embeds: [], components: [], content: 'Sorry, this trade request went stale and is no longer valid.' });
							return;
						}
						if (bTrader === 'system') {
							if (bDirection === 'cancel') {
								buttonCollector.stop('Trade canceled by initiator!');
								delete cardTradeSessions[bSession];
								return;
							} else if (bDirection === 'confirm') {
								if (!cardTradeSessions[bSession]['closing']) {
									cardTradeSessions[bSession]['closing'] = true;
									yourUpButton.setDisabled(true);
									yourDownButton.setDisabled(true);
									theirUpButton.setDisabled(true);
									theirDownButton.setDisabled(true);
									await buttonInteraction.update({ components: [setSelectRow, yourCardSelectRow, yourCardSelectArrowRow, theirCardSelectRow, theirCardSelectArrowRow] });
									return;
								} else {
									await buttonInteraction.reply({ content: 'Be patient! It\'s their turn to consider the offer.', ephemeral: true });
									return;
								}
							}
						} else {
						// TODO Functionalize this?
							const bDecider = bTrader === 'initiator';
							const bInitiator = cardTradeSessions[bSession]['initiator'];
							const bTarget = cardTradeSessions[bSession]['target'];
							const bBinder = await fetchBinder(bDecider ? bInitiator : bTarget);
							const bFocus = cardTradeSessions[bSession][bDecider ? 'initiatorFocus' : 'targetFocus'];
							const bDealSide = bDecider ? 'offer' : 'payment';
							const bNewValue = clamp((cardTradeSessions[bSession][bDealSide][bSet][bFocus] ?? 0) + (bDirection === 'up' ? 1 : -1), 0, bBinder[bSet][bFocus]);
							(bDecider ? yourUpButton : theirUpButton).setDisabled(bNewValue === bBinder[bSet][bFocus]);
							(bDecider ? yourDownButton : theirDownButton).setDisabled(bNewValue === 0);
							cardTradeSessions[bSession][bDealSide][bSet][bFocus] = bNewValue;

							const bYourOfferStringArr = [];
							for (const bySet in cardTradeSessions[bSession]['offer']) {
								bYourOfferStringArr.push(!isEmptySet(cardTradeSessions[bSession]['offer'], bySet) ? `- **${setTranslate[bySet]}**\n` + objectToListMap(Object.entries(cardTradeSessions[bSession]['offer'][bySet]), (i) => (i[1] > 0 ? `   - \`${cardTranslate[i[0]]}\` x${i[1]}` : '')).filter(i => i.length).join('\n') : '');
							}
							let bYourOfferString = bYourOfferStringArr.filter(i => i.length).join('\n\n');

							const bTheirOfferStringArr = [];
							for (const btSet in cardTradeSessions[bSession]['payment']) {
								bTheirOfferStringArr.push(!isEmptySet(cardTradeSessions[bSession]['payment'], btSet) ? `- **${setTranslate[btSet]}**\n` + objectToListMap(Object.entries(cardTradeSessions[bSession]['payment'][btSet]), (i) => (i[1] > 0 ? `   - \`${cardTranslate[i[0]]}\` x${i[1]}` : '')).filter(i => i.length).join('\n') : '');
							}
							let bTheirOfferString = bTheirOfferStringArr.filter(i => i.length).join('\n');

							confirmButton.setDisabled(!(bYourOfferString.length + bTheirOfferString.length));
							if (!bYourOfferString.length) bYourOfferString = '- nothing';
							if (!bTheirOfferString.length) bTheirOfferString = '- nothing';

							const bTradeDescription = `YOU receive:\n${bTheirOfferString}\n\nTHEY receive:\n${bYourOfferString}`;
							const bEmbed = getDefaultEmbed()
								.setTitle('⚠️ TRADE OFFER ⚠️')
								.setDescription(bTradeDescription);
							await buttonInteraction.update({ embeds: [bEmbed], components: [setSelectRow, yourCardSelectRow, yourCardSelectArrowRow, theirCardSelectRow, theirCardSelectArrowRow] });
						}
					} else if (buttonInteraction.user.id === targetPlayer.id) {
						if (bTrader === 'system') {
							if (bDirection === 'cancel') {
								buttonCollector.stop('Trade canceled by target');
								delete cardTradeSessions[bSession];
								return;
							}
						}
						if (bDirection === 'confirm') {
							if (cardTradeSessions[bSession]['closing']) {
								for (const set in cardTradeSessions[bSession]['offer']) {
									for (const card in cardTradeSessions[bSession]['offer'][set]) {
										if (cardTradeSessions[bSession]['offer'][set][card] > 0) {
											removeCard(yourBinder, set, card, cardTradeSessions[bSession]['offer'][set][card]);
											addCard(theirBinder, set, card, cardTradeSessions[bSession]['offer'][set][card]);
										}
									}
								}
								for (const set in cardTradeSessions[bSession]['payment']) {
									for (const card in cardTradeSessions[bSession]['payment'][set]) {
										if (cardTradeSessions[bSession]['payment'][set][card] > 0) {
											removeCard(theirBinder, set, card, cardTradeSessions[bSession]['payment'][set][card]);
											addCard(yourBinder, set, card, cardTradeSessions[bSession]['payment'][set][card]);
										}
									}
								}
								await pushBinder(initiatingPlayer.id, yourBinder);
								await pushBinder(targetPlayer.id, theirBinder);
								delete cardTradeSessions[bSession];
								await buttonInteraction.update({ embeds: [], components: [], content: 'Deal sealed! Enjoy your cards!' });
								return;
							} else {
								await buttonInteraction.reply({ content: 'Be patient! The offer\'s still being set up.', ephemeral: true });
								return;
							}
						}
					} else {
						await buttonInteraction.reply({ content: 'Those buttons aren\'t for you! Shoo, shoo!', ephemeral: true });
						return;
					}
				});

				buttonCollector.on('end', async () => {
					console.log(buttonCollector.endreason);
					const outputText = (buttonCollector.endreason ?? '').length > 0 ? buttonCollector.endreason : 'This trade timed out!';
					await interaction.editReply({ embeds: [], components: [], content: outputText });
					delete cardTradeSessions[sessionID];
				});

				const selectCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time:tradeExpiryTime });
				selectCollector.on('collect', async selectInteraction => {
					if (selectInteraction.user.id === initiatingPlayer.id) {
						await selectInteraction.deferUpdate();
						const [, , sSession, sTrader, ,] = selectInteraction.customId.split('_');
						const chosenSet = selectInteraction.values[0];
						if (sTrader === 'system') {
							cardTradeSessions[sSession]['setFocus'] = chosenSet;
							setSelect.setOptions();
							for (const set of cardSetList) {
								setSelect.addOptions(
									new StringSelectMenuOptionBuilder()
										.setLabel(setTranslate[set])
										.setValue(set)
										.setDefault(set === chosenSet),
								);
							}

							yourCardSelect.setOptions();
							let yDefault = true;
							let yCard;
							for (const card in yourBinder[chosenSet]) {
								yourCardSelect.addOptions(
									new StringSelectMenuOptionBuilder()
										.setLabel((yDefault ? '➡️ ' : '') + cardTranslate[card])
										.setValue(card)
										.setDefault(yDefault),
								);
								yCard = yDefault ? card : yCard;
								yDefault = yDefault && false;
							}

							theirCardSelect.setOptions();
							let tDefault = true;
							let tCard;
							for (const card in theirBinder[chosenSet]) {
								theirCardSelect.addOptions(
									new StringSelectMenuOptionBuilder()
										.setLabel((tDefault ? '⬅️ ' : '') + cardTranslate[card])
										.setValue(card)
										.setDefault(tDefault),
								);
								tCard = tDefault ? card : tCard;
								tDefault = tDefault && false;
							}

							cardTradeSessions[sSession]['initiatorFocus'] = yCard;
							cardTradeSessions[sSession]['targetFocus'] = tCard;

							yourUpButton.setDisabled(cardTradeSessions[sSession]['offer'][chosenSet][yCard] === yourBinder[chosenSet][yCard]);
							yourDownButton.setDisabled(cardTradeSessions[sSession]['offer'][chosenSet][yCard] === 0);
							theirUpButton.setDisabled(cardTradeSessions[sSession]['payment'][chosenSet][tCard] === theirBinder[chosenSet][tCard]);
							theirDownButton.setDisabled(cardTradeSessions[sSession]['payment'][chosenSet][tCard] === 0);

							await selectInteraction.editReply({ components: [setSelectRow, yourCardSelectRow, yourCardSelectArrowRow, theirCardSelectRow, theirCardSelectArrowRow] });
						} else {
							const sSet = cardTradeSessions[sSession]['setFocus'];
							const sDecider = sTrader === 'initiator';
							
							const sInitiator = cardTradeSessions[sSession]['initiator'];
							const sTarget = cardTradeSessions[sSession]['target'];
							const sChoice = selectInteraction.values[0];
							cardTradeSessions[sSession][sDecider ? 'initiatorFocus' : 'targetFocus'] = sChoice;
							// TODO ternarize this, like on the line before the update statement
							if (sDecider) {
								yourCardSelect.setOptions();
								for (const card in yourBinder[sSet]) {
									yourCardSelect.addOptions(
										new StringSelectMenuOptionBuilder()
											.setLabel((card === sChoice ? '➡️ ' : '') + cardTranslate[card])
											.setValue(card)
											.setDefault(card === sChoice),
									);
								}
							} else {
								theirCardSelect.setOptions();
								for (const card in theirBinder[sSet]) {
									theirCardSelect.addOptions(
										new StringSelectMenuOptionBuilder()
											.setLabel((card === sChoice ? '⬅️ ' : '') + cardTranslate[card])
											.setValue(card)
											.setDefault(card === sChoice),
									);
								}
							}
							const sBinder = await fetchBinder(sDecider ? sInitiator : sTarget);
							const sDealSide = sDecider ? 'offer' : 'payment';
							(sDecider ? yourUpButton : theirUpButton).setDisabled((cardTradeSessions[sSession][sDealSide][sSet][sChoice] ?? 0) === sBinder[sSet][sChoice]);
							(sDecider ? yourDownButton : theirDownButton).setDisabled((cardTradeSessions[sSession][sDealSide][sSet][sChoice] ?? 0) === 0);
							// Update all components with changes
							await selectInteraction.editReply({ components: [setSelectRow, yourCardSelectRow, yourCardSelectArrowRow, theirCardSelectRow, theirCardSelectArrowRow] });
						}
					} else {
						await selectInteraction.reply({ content: 'Those dropdowns aren\'t for you! Shoo, shoo!', ephemeral: true });
					}
				});
			}
		}
	},
};