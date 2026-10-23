const mysql = require('mysql');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { cleanDiacritics } = require('./stringy');

const trollFullNameDict = {};
const trollFirstNameDict = {};
const trollTitleDict = {};
const cardTradeSessions = {};

/** Global MySQL Connection Pool.
 * This definition pulls details from the .env file to establish a connection,
 * because hard-coding tokens is terribly insecure.
 * Forbidding multiple statements is the first line of defense against
 * injection attacks.
*/
const con = mysql.createPool({
	connectionLimit: 8,
	host: process.env.SQL_HOST,
	database: process.env.SQL_DB,
	user: process.env.SQL_USER,
	password: process.env.SQL_PW,
	multipleStatements: false,
});


/**
 * Troll call sheet connection
 */
const serviceAccountAuth = new JWT({
	email: process.env.EMAIL,
	key: process.env.PRIVATE_KEY,
	scopes: [
		'https://www.googleapis.com/auth/spreadsheets',
	],
});

/**
 * @description Simplified wrapper for the `mysql.Pool.query` method.
 * @param {String} query Query string formatted with MariaDB syntax
 * @param {Array} [params=[]] Escaped query values. More info {@link https://github.com/mysqljs/mysql#escaping-query-values here}.
 * @returns an array of query result objects, or an empty list.
 * @example let queryResult = await fetchSQL("SELECT ? FROM ??", ["title", "move"]);
 */
const fetchSQL = (query, params = []) => {
	return new Promise((resolve, reject) => {
		con.query(query, params, (err, elements) => {
			if (err) {
				console.log(`Error while processing query: ${query}`, err);
				return reject(err);
			}
			return resolve(elements);
		});
	});
};

/**
 * @description Loads the troll call
 * @returns List of first names, full names, and adult titles with which to look up trolls
 */
async function loadTrollCall() {
	const start = new Date();
	console.log('Loading Troll Call...');
	try {
		const doc = new GoogleSpreadsheet(process.env.TROLL_CALL_DOC_ID, serviceAccountAuth);
		await doc.loadInfo();

		// Alterniabound trolls
		const alterniaSheet = doc.sheetsByIndex[0];
		await alterniaSheet.loadCells();
		for (const troll in trollFullNameDict) if (Object.prototype.hasOwnProperty.call(trollFullNameDict, troll)) delete trollFullNameDict[troll];
		for (const troll2 in trollFirstNameDict) if (Object.prototype.hasOwnProperty.call(trollFirstNameDict, troll2)) delete trollFirstNameDict[troll2];
		for (let col = 0; col < alterniaSheet.columnCount; col++) {
			for (let row = 1; row < alterniaSheet.rowCount; row++) {
				const cell = alterniaSheet.getCell(row, col);
				if (typeof cell.hyperlink !== 'undefined') {
					const cellName = cleanDiacritics(cell.value.toString().toLowerCase());
					trollFullNameDict[cellName] = cell.hyperlink;
					if (cellName.includes('??????') && (cellName !== '?????? ??????')) {
						const name = cellName.replace('??????', '').trim();
						trollFirstNameDict[name] = cell.hyperlink;
					} else if (cellName.includes(' ')) {
						const array = cellName.split(' ');
						trollFirstNameDict[array[0]] = cell.hyperlink;
					}
				}
			}
		}

		// Spacebound trolls
		const spaceSheet = doc.sheetsByIndex[4];
		await spaceSheet.loadCells();
		for (const troll in trollTitleDict) if (Object.prototype.hasOwnProperty.call(trollTitleDict, troll)) delete trollTitleDict[troll];
		for (let col = 0; col < spaceSheet.columnCount; col++) {
			for (let row = 1; row < spaceSheet.rowCount; row++) {
				const cell = spaceSheet.getCell(row, col);
				if (typeof cell.hyperlink !== 'undefined') {
					const cellName = cleanDiacritics(cell.value.toString().toLowerCase());
					const title = cellName.substring(4);
					trollTitleDict[title] = cell.hyperlink;
				}
			}
		}

		const end = new Date();
		const time = (end - start) / 1000;
		console.log(`Troll Call updated @ ${new Date().toLocaleString()}! (${time}s)`);
		return [trollFirstNameDict, trollFullNameDict, trollTitleDict];
	} catch (e) {
		console.log('Couldn\'t update the Troll Call! Reason: ', e);
	}
}

/**
 * @description Formats an ID as a valid Google Doc
 * @param {String} id the document ID
 * @returns the Google Doc URL as a String
 */
function getDocLink(id) {
	return `https://docs.google.com/document/d/${id}`;
}

module.exports = {
	con: con,
	fetchSQL: fetchSQL,
	loadTrollCall: loadTrollCall,
	getDocLink: getDocLink,
	trollFullNameDict: trollFullNameDict,
	trollFirstNameDict: trollFirstNameDict,
	trollTitleDict: trollTitleDict,
	cardTradeSessions: cardTradeSessions,
};