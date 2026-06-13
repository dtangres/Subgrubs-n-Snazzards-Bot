const numerics = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ?!';
const seconds = 1000;
const minutes = 60 * seconds;
const hours = 60 * minutes;
const days = 24 * hours;

/**
 * @desc provides simple number rounding functionality
 * @param {Number} value number to round
 * @param {Integer} decimals number of decimal places to round to
 * @returns a rounded number
 */
function round(value, decimals) {
	return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

/**
 * @desc clamps a numeric value between a range [a, b].
 * @param {Number} x the value to clamp
 * @param {Number} a the lower range of the clamp
 * @param {Number} b the upper range of the clamp
 * @returns the clamped number (guaranteed to be in [a, b])
 */
function clamp(x, a, b) {
	return Math.max(Math.min(x, b), a);
}

/**
 * @desc zips two arrays of equal length `N` into `N` pairs
 * @param {Array} a the first array
 * @param {Array} b the second array
 * @returns an array of two-element arrays
 */
function zip(a, b) {
	return a.map((e, i) => [e, b[i]]);
}

/**
 * @desc Applies a function to the values of an object, keeping the keys intact
 * @param {Object} object an object upon whose values a function will be applied
 * @param {function} mapFn a function to apply to the values of `object`
 * @returns a new object modified in accordance with `mapFn` with the keys of `object`
 * @example // Returns {apples: 4, bananas: 16, grapes: 9}
 * const squaredWeights = objectMap({apples: 2, bananas: 4, grapes: 3}, x => x**2);
 */
function objectMap(object, mapFn) {
	return Object.keys(object).reduce(function (result, key) {
		result[key] = mapFn(object[key]);
		return result;
	}, {});
}

/**
 * @desc Applies a function to the values of an object, returning a list of modified values without the corresponding keys
 * @param {Object} object an object upon whose values a function will be applied
 * @param {function} mapFn a function to apply to the values of `object`
 * @returns a new list of values modified from `object`'s values accordance with `mapFn`
 * @example // Returns [4, 16, 9]
 * const squaredWeightsList = objectToListMap({apples: 2, bananas: 4, grapes: 3}, x => x**2);
 */
function objectToListMap(object, mapFn) {
	return Object.keys(object).reduce(function (result, key) {
		result.push(mapFn(object[key]));
		return result;
	}, []);
}

/**
 * @desc parses a base 10 integer out of a string containing a number in any base in `[2, 64]`
 * @param {String} num the string representation of the number to convert in base `radix`
 * @param {Integer} radix a base in `[2, 64]`
 * @returns a base 10 integer corresponding to the demical value of the given number
 */
function parseInt64(num, radix = 10) {
	if (radix % 1 !== 0 || (radix < 2 || radix > 64)) {
		throw new Error(`Radix out of range [2, 64]! (Received ${radix})`);
	} else {
		const allowedRange = numerics.slice(0, radix);
		const regex = `[${allowedRange}]+$`;
		if (!num.match(regex)) {
			throw new Error(`Number provided is not valid in base ${radix}! (${num})`);
		} else {
			return [...num].reduce((r, a) => r * radix + numerics.slice(0, radix).indexOf(a), 0);
		}
	}
}

/**
 * @desc a simply utility function for taking the log of a number in an arbitrary base
 * @param {Number} n the base to take a log with
 * @param {Number} b the number to take a log base n of
 * @returns log base n of b
 */
function logBase(n, b) {
	return Math.log(b) / Math.log(n);
}

/**
 * @desc produces a string representation of a decimal number, converted to an arbitrary base
 * @param {Integer} num the decimal number to convert
 * @param {Integer} radix the target base in [2, 64]
 * @returns a string representing `num` in base `radix`
 */
function toString64(num, radix = 10) {
	if (radix % 1 !== 0 || (radix < 2 || radix > 64)) {
		throw new Error(`Radix out of range [2, 64]! (Received ${radix})`);
	} else {
		let result = '';
		let currentPlace = Math.floor(logBase(radix, num));
		let quotient;
		while (currentPlace >= 0) {
			quotient = Math.floor(num / (radix ** currentPlace));
			result += numerics[quotient];
			num -= quotient * (radix ** currentPlace);
			currentPlace--;
		}
		return result;
	}
}

/**
 * @returns the current time in milliseconds
 */
function getCurrentTimestamp() {
	return new Date().getTime();
}

/**
 * @desc helper method for command setup. Converts a list [a, b, ..., y, z] into [{name: "a", value: "a"}, ...]
 * @param {Array<String>} values A list of string values to convert into command options
 * @returns a list of objects representing command options to be unpacked
 */
function easyListItems(values) {
	return values.map((v) => ({ name: v, value: v }));
}

function sum(arr) {
	return arr.reduce((a, c) => a + c);
}

function any(arr) {
	return arr.reduce((a, c) => a || c);
}

function all(arr) {
	return arr.reduce((a, c) => a && c);
}

module.exports = {
	round: round,
	zip: zip,
	objectMap: objectMap,
	objectToListMap: objectToListMap,
	parseInt64: parseInt64,
	toString64: toString64,
	getCurrentTimestamp: getCurrentTimestamp,
	clamp: clamp,
	easyListItems: easyListItems,
	sum: sum,
	any: any,
	all: all,
	seconds: seconds,
	minutes: minutes,
	hours: hours,
	days: days,
};