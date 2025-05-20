const { colorDict } = require('../utils/info');
const { RNG } = require('../utils/prng');

/**
 * @function
 * @returns a randomly generated float on [0, 1) using Kybos, outlined {@link http://baagoe.com/en/RandomMusings/javascript/ here}.
 */
const random = RNG();


/**
 * @desc Selects randomly from a weighted list of choices. `args` can either be a list `[]`, two lists `[] []`, or an object `{}`.
 * @returns a randomly selected weighted choice from the list, or a random choice if no weights are provided (single list)
 * @example const choiceFromList = rollWeighted(["apples", "bananas", "grapes"]);
 * const choiceFromTwoLists = rollWeighted(["apples", "bananas", "grapes"], [2, 4, 3]);
 * const choiceFromObject = rollWeighted({apples: 2, bananas: 4, grapes: 3})
 */
function rollWeighted() {
	let cumulativeWeights;
	let myChoices;
	if (arguments.length === 1) {
		if (Array.isArray(arguments[0])) {
			myChoices = arguments[0];
			// What an annoying way to generate a list from 1..N
			cumulativeWeights = [...Array(arguments[0].length).keys()].map(i => i + 1);
		} else {
			myChoices = Object.keys(arguments[0]);
			cumulativeWeights = Object.values(arguments[0]).map((sum => value => sum += value)(0));
		}
	} else if (arguments.length === 2) {
		myChoices = arguments[0];
		cumulativeWeights = arguments[1].map((sum => value => sum += value)(0));
	}
	const weightMax = cumulativeWeights.slice(-1)[0];
	const roll = roll1ToX(weightMax);
	for (let i = 0; i < cumulativeWeights.length; i++) {
		if (cumulativeWeights[i] >= roll) {
			return myChoices[i];
		}
	}
}

/**
 * @desc Basic utility random roll.
 * @returns a random float over `[0, 1)`
 */
function rollFloat() {
	return random();
}

/**
 * @desc Rolls a random integer over `[1, N]`
 * @param {Integer} diceType the upper range to roll over, inclusive
 * @returns a random integer from `1` to `N`.
 * @example const sixSidedDieRoll = roll1ToX(6);
 */
function roll1ToX(diceType) {
	return Math.floor(rollFloat() * diceType) + 1;
}

/**
 * @desc Rolls `(X+t)dY`, plus additional dice depending on talent. Actual keep/drop mechanics are handled by the calling method.
 * @param {Integer} diceType size of dice `Y` to roll
 * @param {Integer} [amt=1] base amount of dice `X` to roll
 * @param {Integer} [talent=0] |`t`| additional dice to roll
 * @returns an array of dice results
 * @example const roll = rollDice(6) // 1d6
 * const roll = rollDice(8, 3) // 4d8
 * const roll = rollDice(20, 1, 1) // 1d20 + 1d20
 * const roll = rollDice(20, 1, -1) // 1d20 + 1d20
 */
function rollDice(diceType, amt = 1, talent = 0) {
	const result = [];
	for (let i = 0; i < amt + Math.abs(talent); i++) {
		const roll = roll1ToX(diceType);
		result.push(roll);
	}
	return result;
}

/**
 * @desc Helper method. Marks numbers in a sequence for final summation based on talent while maintaining the original order of the numbers rolled.
 * @param {Array<Integer>} arr list of dice results
 * @param {Integer} num the number of results to mark
 * @param {Integer} talent number of dice to keep (+) or drop (-). Actual amount is irelevant; only sign matters
 * @returns array of 0s and 1s corresponding to which numbers will be summed
 */
function markForSum(arr, num, talent) {
	let result;
	(result = []).length = arr.length;
	result.fill(0);
	const keys = Array.from({ length: arr.length }, (v, k) => k);
	// Sorts list positions by how small/large their corresponding values are
	keys.sort((a, b) => (talent < 0 ? arr[a] - arr[b] : arr[b] - arr[a]));
	// Marks the first `num` results for summation
	for (let i = 0; i < num; i++) {
		result[keys[i]] = 1;
	}
	return result;
}

/**
 * @desc produces a sting for modifier additions in dice rolls (`+1`, `-3`, etc).
 * @param {Integer} num the whole number to render as a modifier
 * @param {Boolean} spacey whether or not to space out the modifier (`+4` vs. ` + 4`)
 * @returns the modifier as a string, or the empty string if `num === 0`
 */
function modStr(num, spacey = false) {
	return num ? `${spacey ? ' ' : ''}${num !== 0 ? (num > 0 ? '+' : '-') : ''}${spacey ? ' ' : ''}${Math.abs(num)}` : '';
}

/**
 * @desc Helper method. Rolls dice according to speicifications and returns propeties of the roll. Hard-coded support for `ALL THE DICE`.
 * @param {Integer} diceType the type of die to use (`d2`, `d4`, `d10(+d6)`, `d8`)
 * @param {Integer} talent the number of highest dice to keep (+) or drop (-)
 * @param {Integer} modifier modifier added to the final roll result
 * @returns an object with the following properties:
 * - `weird`: whether or not the roll was made using `ALL THE DICE`
 * - `min`: whether or not the roll was a `MIN`
 * - `max`: whether or not the roll was a `MAX`
 * - `sum`: total sum of dice rolled
 * - `text`: text to display in an embed when invoked
 */
function formatRoll(diceType, talent, modifier) {
	const baseDice = { 2: 8, 4: 4, 10: 1, 8: 2, 16:1 };
	const addlDice = { 2: 0, 4: 2 * talent, 10: talent, 8: talent, 16: talent };
	const numArr = rollDice(diceType, baseDice[diceType], addlDice[diceType]);
	const indices = markForSum(numArr, baseDice[diceType], talent);
	let totalSum = 0;
	for (let i = 0; i < numArr.length; i++) {
		totalSum += numArr[i] * indices[i];
	}
	let max = false;
	let min = false;
	if (diceType === 8) {
		if (totalSum === 16 || totalSum + modifier >= 20) {
			max = true;
		}
		if (totalSum === 2 || totalSum + modifier < 0) {
			min = true;
		}
	}

	const stringNums = [];
	for (let i = 0; i < numArr.length; i++) {
		let item = `${numArr[i]}`;
		if (numArr[i] === 1 || numArr[i] === diceType) {
			item = `**${item}**`;
		}
		if (indices[i] === 0) {
			item = `~~${item}~~`;
		}
		stringNums.push(item);
	}

	const extraDie = diceType === 10 ? rollDice(6, 1, 0)[0] : 0;

	totalSum += extraDie + modifier * (diceType !== 2);
	return {
		weird: diceType !== 8,
		min: min,
		max: max,
		sum: totalSum,
		text: `(${stringNums.join(', ')}${diceType === 10 ? modStr(extraDie, true) : ''})${diceType === 2 ? '' : modStr(modifier, true)}`,
	};
}

/**
 * @desc formats dice rolls with talent and modifies in the style of Avrae, keeping numbers in the order rolled
 * @param {Integer} amt number of dice to roll
 * @param {Integer} size size of dice to roll
 * @param {Integer} keeps number of highest dice to keep (+) or toss (-)
 * @param {Integer} mod modifier for final roll
 * @returns a string of dice results in parentheses, with dropped dice struck through and min/max results bolded, with the modifier appended to the end.
 */
function formatRawRoll(amt, size, keeps, mod) {
	const numArr = rollDice(size, amt);
	const indices = markForSum(numArr, keeps === 0 ? amt : Math.abs(keeps), keeps);
	let totalSum = 0;
	for (let i = 0; i < numArr.length; i++) {
		totalSum += numArr[i] * indices[i];
	}

	const stringNums = [];
	for (let i = 0; i < numArr.length; i++) {
		let item = `${numArr[i]}`;
		if (numArr[i] === 1 || numArr[i] === size) {
			item = `**${item}**`;
		}
		if (indices[i] === 0) {
			item = `~~${item}~~`;
		}
		stringNums.push(item);
	}

	totalSum += mod;
	return { sum: totalSum, text: `(${stringNums.join(', ')})${modStr(mod, true)}` };
}

/**
 * @desc gets an embed color corresponding to roll properties
 * @param {Object} rollResult a roll result object generated by `formatRoll`
 * @returns a color from {@link colorDict}
 * @see {@link formatRoll}
 */

function getRollColor(rollResult) {
	let result = colorDict.BOT;
	if (rollResult.sum < 0) result = colorDict.RUST;
	if (rollResult.sum >= 0) result = colorDict.BRONZE;
	if (rollResult.sum >= 8) result = colorDict.GOLD;
	if (rollResult.sum >= 11) result = colorDict.OLIVE;
	if (rollResult.sum >= 14) result = colorDict.INDIGO;
	if (rollResult.min) result = colorDict.RUST;
	if (rollResult.max)	result = colorDict.FUCHSIA;
	if (rollResult.weird) result = colorDict.LIME;
	return result;
}

/**
 * @desc gets a roll result name corresponding to roll properties
 * @param {Object} rollResult a roll result object generated by `formatRoll`
 * @returns a result from 'NAT MIN' to 'NAT MAX'
 */

function getRollResultName(rollResult) {
	let result = 'INVALID';
	if (rollResult.sum < 0) result = 'MIN';
	if (rollResult.sum >= 0) result = 'BAD';
	if (rollResult.sum >= 8) result = 'OK';
	if (rollResult.sum >= 11) result = 'GOOD';
	if (rollResult.sum >= 14) result = 'GREAT';
	if (rollResult.min) result = 'MIN';
	if (rollResult.max)	result = 'MAX';
	return result;
}

/**
 * @desc generates a random base36 string [a-z0-9] of length X.
 * @param {Number} length a length for the string
 * @returns {String} a base36 string of the specified length
 */
function generateBase36String(length) {
	const pool = 'abcdefghijklmnopqrstuvwxyz0123456789'
	let result = ''
	while (length > 0) {
		result += pool[roll1ToX(pool.length) - 1]
		length -= 1
	}
	return result
}


module.exports = {
	rollWeighted: rollWeighted,
	rollDice: rollDice,
	modStr: modStr,
	formatRoll: formatRoll,
	formatRawRoll: formatRawRoll,
	getRollColor: getRollColor,
	getRollResultName: getRollResultName,
	roll1ToX: roll1ToX,
	rollFloat: rollFloat,
	generateBase36String: generateBase36String,
};