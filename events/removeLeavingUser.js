const { Events } = require('discord.js');
const { fetchSQL } = require('../utils/db');
require('dotenv').config();

module.exports = {
	name: Events.GuildBanAdd,
	async execute(interaction) {
		// Retrieve snowflake of banned user
		const bannedUserSnowflake = interaction.user.id;

		// Get all orphaned pinglists the banned user owned, delete them
		let query = 'SELECT `name` FROM `pinglist` WHERE `snowflake` = ? AND `record` = \'owner\'';
		const bannedUserPinglists = await fetchSQL(query, [bannedUserSnowflake]);
		for (const record of bannedUserPinglists) {
			query = 'SELECT * FROM `pinglist` WHERE `record` = \'owner\' AND `name` = ?';
			const onwerNumber = await fetchSQL(query, [record.name]);
			if (ownerNumber === 1) {
				// Destroy orphans
				query = 'DELETE FROM `pinglist` WHERE `name` = ?';
				await fetchSQL(query, [record.name]);
			} else {
				// Remove entry
				query = 'DELETE FROM `pinglist` WHERE `snowflake` = ? AND `record` = \'owner\' AND `name` = ?';
				await fetchSQL(query, [record.name]);
			}
			
		}

		// Remove banned user from remaining pinglists
		query = 'DELETE FROM `pinglist` WHERE `snowflake` = ?';
		await fetchSQL(query, [bannedUserSnowflake]);

		// Delete banned user's troll call
		query = 'DELETE FROM `trollcall` WHERE `userID` = ?';
		await fetchSQL(query, [bannedUserSnowflake]);

		// Delete banned user's card binder
		query = 'DELETE FROM `player` WHERE `snowflake` = ?';
		await fetchSQL(query, [bannedUserSnowflake]);
	},
};