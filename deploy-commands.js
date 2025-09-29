const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { isAllowed } = require('./utils/conditions');

const argv = require('minimist')(process.argv.slice(2));

const commandsGlobal = [];
const commandsLocal = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const globalBlacklist = ['banish.js', 'patch.js'];

const commandConditions = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands/commandConditions.json'), 'utf8'));

for (const file of commandFiles) {
	const commandName = file.slice(0, -3);
	if (commandConditions[commandName] && !isAllowed(commandConditions[commandName])) {
		console.log(`Skipped ${commandName}`);
		continue;
	}
	const command = require(`./commands/${file}`);
	const json = command.data.toJSON();
	// Only locally push blacklisted/dev-only commands
	if (globalBlacklist.includes(`${file}`) || (json.description || '').includes('<DEV COMMAND>')) {
		console.log(`Pushed ${file} with no visibility`);
	} else {
		commandsGlobal.push(json);
		console.log(`Pushed ${file}`);
	}
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Const clear = false;

if (!(argv._.includes('clear'))) {
	console.log(argv._);
	(async () => {
		try {
			console.log(`Started refreshing ${commandsLocal.length} LOCAL application (/) commands.`);
			const data = await rest.put(
				Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID),
				{ body: commandsLocal },
			);
			console.log(`Successfully reloaded ${data.length} LOCAL application (/) commands.`);
		} catch (error) {
			console.error('An error occurred wihle refreshing LOCAL commands:', error);
		}

		try {
			console.log(`Started refreshing ${commandsGlobal.length} GLOBAL application (/) commands.`);
			const data = await rest.put(
				Routes.applicationCommands(process.env.APP_ID),
				{ body: commandsGlobal },
			);
			console.log(`Successfully reloaded ${data.length} GLOBAL application (/) commands.`);
		} catch (error) {
			console.error('An error occurred wihle refreshing GLOBAL commands:', error);
		}
	})();
} else {
	(async () => {
		try {
			console.log(`Started deleting ${commandsLocal.length} application (/) commands LOCALLY.`);
			await rest.put(
				Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID),
				{ body: [] },
			);
			console.log('Successfully deleted application (/) commands LOCALLY');
		} catch (error) {
			console.error('An error occurred wihle deleting commands:', error);
		}

		try {
			console.log(`Started deleting ${commandsGlobal.length} application (/) commands GLOBALLY.`);
			await rest.put(
				Routes.applicationCommands(process.env.APP_ID),
				{ body: [] },
			);
			console.log('Successfully deleted application (/) commands GLOBALLY');
		} catch (error) {
			console.error('An error occurred wihle deleting commands:', error);
		}
	})();
}