// Const Canvas = require('@napi-rs/canvas');
const fs = require('fs');
const { zip, objectToListMap } = require('./math');
const { rollWeighted } = require('./dice');
const { cardCache, currentSet } = require('./info');
const { getDefaultEmbed } = require('./stringy');
const { fetchSQL } = require('./db');
const { AttachmentBuilder } = require('discord.js');

const GradientAlignment = {
	VERTICAL: 'vertical',
	HORIZONTAL: 'horizontal',
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

function getCardData(style) {
	return JSON.parse(fs.readFileSync(`./cards/${style}/data.json`, 'utf8'));
}

/**
 * @desc Returns a randomly selected card from the current set according to drop weights
 * @param {String} style the card set to roll from
 * @returns a randomly selected card from the current set according to drop weights
 */
async function getRandomCard(style) {
	const { card_info } = getCardData(style);
	const { drop_table } = card_info;
	const weightTable = loadWeightTable(drop_table);
	const cardChoice = rollWeighted(weightTable);
	console.log(`Card selected: ${cardChoice}`);
	const cardImage = await getCardImage(style, cardChoice);
	return { name: cardChoice, image: cardImage };
}

/**
 * @desc Retrieves a card from a set if it exists - either from cache, or by generating a new card
 * @param {String} style the set to draw from
 * @param {String} name the card to retrieve an image for
 * @returns the card image as a `.png` file
 */
// TODO add error handling for set/card misses
// TODO add reply deferral in case of long generation time
async function getCardImage(style, name) {
	const target = `${style}_${name}`;
	if (!(target in cardCache)) {
		cardCache[target] = await generateCard(style, name);
	}
	return cardCache[target];
}

/**
 * @desc Generates card art using set/card-specific instructions for drawing
 * @param {String} style the set to draw from
 * @param {String} name the card to retrieve an image for
 * @returns the card image as a `.png` file
 */
async function generateCard(style, name) {
	const data = getCardData(style);
	const { paintCard } = require(`../cards/${style}/paint.js`);
	console.log('Painting card...');
	const result = await paintCard(data, name);
	console.log('Returning card...');
	return result;
}

/**
 * @param {String} snowflake the snowflake of the player whose binder is being accessed
 * @returns an Object representing the player's binder, or the empty object if no binder exists under that name
 */
async function fetchBinder(snowflake) {
	const queryResult = await fetchSQL('SELECT `binder` FROM `player` WHERE `snowflake` = ?', [snowflake]);
	return queryResult.length ? JSON.parse(queryResult[0]['binder']) : {};
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
	if (!binder[set][name]) throw Error('This binder doesn\'t have any of the card being removed.');
	binder[set][name] -= quantity;
	clearEmptiesInBinder(binder);
}

/**
 * @desc Stringifies a player binder and pushes it into the database
 * @param {String} snowflake the snowflake ID of the player to whom the binder belongs
 * @param {Object} binder the binder
 */
async function pushBinder(snowflake, binder) {
	const blob = JSON.stringify(binder);
	await fetchSQL('INSERT INTO `player` (`snowflake`, `binder`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `binder` = ?', [snowflake, blob, blob]);
}

/**
 * @desc Removes empty sets or cards with 0 amount in sets
 * @param {Object} binder the binder to clean up
 * @returns a cleaned-up binder
 */
async function clearEmptiesInBinder(binder) {
	for (const [set_, cards] of Object.entries(binder)) {
		let emptySet = true;
		for (const [card, amount] of Object.entries(cards)) {
			if (amount === 0) {
				delete binder[set_][card];
			} else {
				emptySet = false;
			}
		}
		if (emptySet) {
			delete binder[set_];
		}
	}
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
async function handlePlayerReward(snowflake, set, name, time) {
	const binder = await fetchBinder(snowflake);
	addCard(binder, set, name);
	pushBinder(snowflake, binder);
	updateCooldown(snowflake, time);
}

/**
 * @desc formulates a message with which to present card drops
 * @param {String} set the set to which the dropped card belongs
 * @param {String} name the name of the card
 * @returns an Object representing a valid Discord interaction reply message containing card art and congratulations
 */
async function postCard(set, name) {
	const card = await getCardImage(set, name);
	const attachment = new AttachmentBuilder(card, { name: 'card.png' });
	const embed = getDefaultEmbed()
		.setImage('attachment://card.png');
	return { embeds: [embed], files: [attachment], ephemeral: true };
}

/**
 * @desc produces a string of list items representing the contents of a card binder
 * @param {String} set the set to showcase
 * @param {String} binder the binder to showcase
 * @returns a string of newline-separated list items
 */
// TODO These should be sorted before printing
async function getPrettyBinderSummary(set, binder) {
	if (!binder[set]) {
		return 'You don\'t have any cards in this year\'s set yet!';
	} else {
		const { card_info } = getCardData(set);
		const { cards } = card_info;
		const summary = objectToListMap(Object.keys(cards), function(card) {
			return `- \`${cards[card]['card_name']}\`: x${binder[currentSet][card] ?? 0}`;
		}).join('\n');
		return summary;
	}
}

module.exports = {
	makeGradient: makeGradient,
	generateCard: generateCard,
	loadWeightTable: loadWeightTable,
	getRandomCard: getRandomCard,
	fetchBinder: fetchBinder,
	handlePlayerReward: handlePlayerReward,
	postCard: postCard,
	getPrettyBinderSummary: getPrettyBinderSummary,
	addCard: addCard,
	removeCard: removeCard,
	pushBinder: pushBinder,
	clearEmptiesInBinder: clearEmptiesInBinder,
};