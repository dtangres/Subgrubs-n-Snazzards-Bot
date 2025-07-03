// Const Canvas = require('@napi-rs/canvas');
const fs = require('fs');
const { zip, objectToListMap, toString64, sum, all } = require('./math');
const { rollWeighted } = require('./dice');
const { cardCache, cardSetList, visibleCardSetList, setTranslate, cardTranslate, colorDict } = require('./info');
const { getDefaultEmbed } = require('./stringy');
const { fetchSQL, cardTradeSessions } = require('./db');
const { AttachmentBuilder } = require('discord.js');

/**
 * Represents a possible alignment for a gradient in card drawing.
 * @readonly
 * @enum {String}
*/
const GradientAlignment = {
	VERTICAL: 'vertical',
	HORIZONTAL: 'horizontal',
};


/**
 * Represents one of three possible states for a session,
 *   returned in reply to a session initiation.
 * @readonly
 * @enum {String}
*/
const SessionStatus = {
	/** Initiator is already trading cards */
	InitiatorBusy: 'init_busy',
	/** Target is already trading cards */
	TargetBusy: 'target_busy',
	/** Both the initiator and target are idle */
	SessionPossible: 'session_ok',
};


/**
 * Creates a gradient from a list of stops and colors, either vertically or horizontally
 * @param {Canvas.SKRSContext2D} ctx The context to which the gradient belongs
 * @param {Canvas.Canvas} canvas The canvas upon which the gradient is drawn
 * @param {GradientAlignment} align The alignment of the gradient (assumed to be the size of the image)
 * @param {Array} stop_points A list of stops on interval [0, 1]
 * @param {Array} stop_colors A list of the colors for each stop
 * @returns {CanvasGradient} A finished gradient for use as a path fill
*/
function makeGradient(ctx, canvas, align, stop_points, stop_colors) {
	const grd = ctx.createLinearGradient(0, 0, canvas.width * (align === GradientAlignment.HORIZONTAL), canvas.height * (align === GradientAlignment.VERTICAL));
	for (const i of zip(stop_points, stop_colors)) {
		grd.addColorStop(...i);
	}
	return grd;
}

/**
 * @desc Loads a weight table from a list of weights specified in a card set's data file. Default weight is always 1
 * @param {Object} raw a list of arrays or objects with a single value: a card's name and its weight
 * @returns an Object consisting of card names and weights
 */
function loadWeightTable(raw) {
	const result = {};
	for (const i in raw) {
		result[raw[i][0]] = raw[i][1] ?? 1;
	}
	return result;
}

/**
 * @desc retrieves stylistic information for drawing a card in a given style
 * @param {String} style the card style to retrieve data for
 * @returns a JSON blob from a file corresponding to the selected style
 */
function getCardData(style) {
	return JSON.parse(fs.readFileSync(`./cards/${style}/data.json`, 'utf8'));
}

/**
 * @desc Returns a randomly selected card from the current set according to drop weights
 * @param {String} style the card set to roll from
 * @returns a randomly selected card from the current set according to drop weights
 */
async function getRandomCard(pool) {
	const cardSet = rollWeighted(pool);
	const { card_info } = getCardData(cardSet);
	const { drop_table } = card_info;
	const cardChoice = rollWeighted(drop_table);
	return { name: cardChoice, set: cardSet, desc: card_info.cards[cardChoice].description, spoiler: card_info.cards[cardChoice].spoiler };
}

/**
 * @desc Retrieves a card from a set if it exists - either from cache, or by generating a new card
 * @param {String} style the set to draw from
 * @param {String} name the card to retrieve an image for
 * @returns the card image as a `.png` file
 */
// TODO add error handling for set/card misses
// TODO add reply deferral in case of long generation time
async function getCardImage(set, name) {
	const target = `${set}_${name}`;
	if (!(target in cardCache)) {
		cardCache[target] = await generateCard(set, name);
	}
	return cardCache[target];
}

/**
 * @desc Generates card art using set/card-specific instructions for drawing
 * @param {String} style the set to draw from
 * @param {String} name the card to retrieve an image for
 * @returns the card image as a `.png` file
 */
async function generateCard(set, name) {
	const data = getCardData(set);
	const { paintCard } = require(`../cards/style/${data['style']}/paint.js`);
	const result = await paintCard(data, set, name);
	return result;
}

async function makeNewBinder() {
	const result = {};
	for (const style of cardSetList) {
		result[style] = {};
		const data = getCardData(style);
		const { card_names } = data['card_info'];
		for (const card of card_names) {
			result[style][card] = 0;
		}
	}
	return result;
}

/**
 * @param {String} snowflake the snowflake of the player whose binder is being accessed
 * @returns an Object representing the player's binder, or the empty object if no binder exists under that name
 */
async function fetchBinder(snowflake) {
	const queryResult = await fetchSQL('SELECT `binder` FROM `player` WHERE `snowflake` = ?', [snowflake]);
	return queryResult.length ? JSON.parse(queryResult[0]['binder']) : makeNewBinder();
}

/**
 * @desc Adds a card to a binder. Creates binder space if necessary
 * @param {Object} binder the player binder to modify
 * @param {String} set the set to add the card from
 * @param {String} name the name of the card to add
 * @param {Integer} quantity the amount of cards to add (default 1)
 */
// TODO Figure out default parameter notation in JSDoc
async function addCard(binder, set, name, quantity = 1) {
	if (!binder[set]) binder[set] = { [name]: 0 };
	if (!binder[set][name]) binder[set][name] = 0;
	binder[set][name] += quantity;
}

/**
 * @desc Removes a card from a binder and throws an error if the card does not exist in the binder (or the corresponding set)
 * @param {Object} binder the player binder to modify
 * @param {String} set the set to remove the card to
 * @param {String} name the name of the card to remove
 * @param {Integer} quantity the amount of cards to remove (default 1)
 */
async function removeCard(binder, set, name, quantity = 1) {
	if (!binder[set]) throw Error('The binder you are trying to remove a card from does not exist.');
	if (!binder[set][name]) throw Error(`This binder doesn't have any of the card being removed: ${set}, ${name}.`);
	binder[set][name] -= quantity;
}

/**
 * @desc Stringifies a player binder and pushes it into the database
 * @param {String} snowflake the snowflake ID of the player to whom the binder belongs
 * @param {Object} binder the binder
 */
async function pushBinder(snowflake, binder = null) {
	const blob = JSON.stringify(binder === null ? await makeNewBinder() : binder);
	await fetchSQL('INSERT INTO `player` (`snowflake`, `binder`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `binder` = ?', [snowflake, blob, blob]);
}

/**
 * @desc Updates the time of last card drop in the player database.
 * @param {String} snowflake the snowflake ID of the player to whom the binder belongs
 * @param {Integer} time the time in milliseconds since world epoch
 */
async function updateCooldown(snowflake, time) {
	await fetchSQL('UPDATE `player` SET `last_drop` = ? WHERE `snowflake` = ?', [time, snowflake]);
}

/**
 * @desc Helper function for processing a successul card drop
 * @param {String} snowflake the snowflake ID of the player who received a card
 * @param {String} set the set to which the dropped card belongs
 * @param {String} name the name of the card
 * @param {Integer} time the time of the dorp in milliseconds since world epoch
 */
async function handlePlayerReward(snowflake, set, name, time = 0) {
	const binder = await fetchBinder(snowflake);
	await addCard(binder, set, name);
	await pushBinder(snowflake, binder);
	if (time > 0) {
		await updateCooldown(snowflake, time);
	}
}

/**
 * @desc formulates a message with which to present card drops
 * @param {Object} properties the properties of the card drop
 * @returns an Object representing a valid Discord interaction reply message containing card art and congratulations
 */
async function postCard(properties) {
	const set = properties.set;
	const name = properties.name;
	const desc = properties.desc;
	const content = properties.content ?? '';
	const title = properties.title ?? cardTranslate[name];
	const fake = properties.fake ?? false;
	const color = properties.color ?? colorDict.OTHER;
	const spoiler = properties.spoiler ?? false;

	const card = await getCardImage(set, name);
	const attachment = new AttachmentBuilder(card, { name: 'card.png' }).setSpoiler(spoiler);
	const embed = getDefaultEmbed()
		.setColor(color)
		.setTitle(title ?? cardTranslate[name])
		.setImage('attachment://card.png');
	if (desc !== null) embed.setDescription(desc);
	return { content: content, embeds: [embed], files: [attachment], desc: desc, ephemeral: fake };
}

/**
 * @desc produces a string of list items representing the contents of a card binder
 * @param {String} set the set to showcase
 * @param {String} binder the binder to showcase
 * @returns a string of newline-separated list items
 */
async function getPrettyBinderSummary(binder, _set) {
	if (!binder) {
		return 'You don\'t have a binder yet! Also, if you\'re reading this, something went wrong. This isn\'t supposed to happen. Ping Meme and they\'ll fix it.';
	} else {
		const summary = [];
		if (_set === 'all') {
			for (const set of visibleCardSetList) {
				const { card_info } = getCardData(set);
				const { cards } = card_info;
				summary.push(`## ${setTranslate[set]}\n` + objectToListMap(Object.keys(cards).sort(), function(card) {
					return `- \`${cardTranslate[card]}\`: x${(binder[set] ?? [])[card] ?? 0}`;
				}).join('\n'));
			}
		} else {
			const { card_info } = getCardData(_set);
			const { cards } = card_info;
			summary.push(`## ${setTranslate[_set]}\n` + objectToListMap(Object.keys(cards).sort(), function(card) {
				return `- \`${cardTranslate[card]}\`: x${binder[_set][card] ?? 0}`;
			}).join('\n'));
		}
		return summary.join('\n\n');
	}
}

function checkSessionConflict(initiatingPlayer, targetPlayer) {
	const initString = toString64(initiatingPlayer.id, 64);
	const targetString = toString64(targetPlayer.id, 64);
	for (const session of Object.keys(cardTradeSessions)) {
		if (session.startsWith(initString) || session.includes(`.${initString}.`)) {return SessionStatus.InitiatorBusy;}
		if (session.startsWith(targetString) || session.includes(`.${targetString}.`)) {return SessionStatus.TargetBusy;}
	}
	return SessionStatus.SessionPossible;
}

function isEmptySet(binder, set) {
	return (sum(Object.values(binder[set])) === 0);
}

function isEmptyBinder(binder) {
	return all(Object.keys(binder).map((x) => isEmptySet(binder, x)));
}

async function validateBinder(binder) {
	// Iterate through every set and every card name
	for (const setNameIndex in cardSetList) {
		// If a set is not present: populate it with key card names and value zeros
		const setName = cardSetList[setNameIndex];
		if (binder[setName] === undefined) {
			let cards = getCardData(setName)['card_info']['card_names'];
			binder[setName] = Object.fromEntries(cards.map(x => [x, 0]));
		}
	}
}

module.exports = {
	makeGradient: makeGradient,
	generateCard: generateCard,
	loadWeightTable: loadWeightTable,
	getRandomCard: getRandomCard,
	fetchBinder: fetchBinder,
	makeNewBinder: makeNewBinder,
	handlePlayerReward: handlePlayerReward,
	postCard: postCard,
	getPrettyBinderSummary: getPrettyBinderSummary,
	addCard: addCard,
	removeCard: removeCard,
	pushBinder: pushBinder,
	checkSessionConflict: checkSessionConflict,
	isEmptySet: isEmptySet,
	isEmptyBinder: isEmptyBinder,
	getCardData: getCardData,
	validateBinder: validateBinder,
	SessionStatus: SessionStatus,
};