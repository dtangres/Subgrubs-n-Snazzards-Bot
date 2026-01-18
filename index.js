require('dotenv').config();
const { Client, Options, Collection, GatewayIntentBits } = require('discord.js');
const { schedule } = require('node-cron');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./utils/db');
const info = require('./utils/info');
const { getCardData } = require('./utils/cards');
const { isAllowed } = require('./utils/conditions');

// Initialize client
console.log('Initializing client...');
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers],
	sweepers: {
		...Options.DefaultSweeperSettings,
		// Every hour, flush messages older than half an hour
		messages: {
			interval: 3_600,
			lifetime: 1_800,
		},
	},
});

// Establish rate-limit warnings (just in case)
client.on('rateLimit', (msg) => {
	console.log('Rate limit hit:');
	console.log(msg);
});

// Increase number of listeners
client.setMaxListeners(32);

// Load conditions for commands, events
const eventConditions = JSON.parse(fs.readFileSync(path.join(__dirname, 'events/eventConditions.json'), 'utf8'));
const commandConditions = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands/commandConditions.json'), 'utf8'));

// Load commands
console.log('Loading commands...');
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Sending commands...');
for (const file of commandFiles) {
	const commandName = file.slice(0, -3);
	if (commandConditions[commandName] && !isAllowed(commandConditions[commandName])) {
		console.log(`Skipped ${commandName}`);
		continue;
	}
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

// Load event listeners
console.log('Loading events...');
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log('Sending events...');
for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const eventName = file.slice(0, -3);
	const event = require(filePath);
	if (eventConditions[eventName] && !isAllowed(eventConditions[eventName])) {
		console.log(`Skipped ${eventName}`);
		continue;
	}
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
		console.log(`Pushed ONCE ${eventName}`);
	} else {
		client.on(event.name, (...args) => event.execute(...args));
		console.log(`Pushed ON ${eventName}`);
	}
}

// Database events
db.fetchSQL('SET NAMES \'utf8mb4\'');

console.log('Initializing Troll Call...');
const now = new Date();
const minutes = now.getMinutes();
const seconds = now.getSeconds();

db.trollFirstNameDict, db.trollFullNameDict, db.trollTitleDict = db.loadTrollCall();

// Load troll call and other resources
schedule(`${seconds} ${minutes} * * * *`, function () {
	console.log('---------------------');
	db.trollFirstNameDict, db.trollFullNameDict, db.trollTitleDict = db.loadTrollCall();
});

for (const set of info.cardSetList) {
	const { card_info, set_name } = getCardData(set);
	info.setTranslate[set] = set_name;
	for (const card of card_info.card_names) {
		info.cardTranslate[card] = card_info.cards[card].card_name;
	}
}

// Login!
console.log('Logging in...');
client.login(process.env.DISCORD_TOKEN);

// Start role processing jobs
const CronJob = require('cron').CronJob;

const wrigglerRemovalJob = new CronJob(
	// Check at midnight. Midnight where? Who knows
	'0 0 * * *',
	async function () {
		try {
			console.log('Checking for old wrigglers.');
			const guild = client.guilds.cache.get(process.env.GUILD_ID);
			console.log('Fetching roles...');
			await guild.roles.fetch();
			await guild.members.fetch();
			console.log('Collecting Wriggler role...');
			const wrigglerRole = guild.roles.cache.find(role => role.id === process.env.WRIGGLER_ROLE_ID);
			// Guild.roles.cache.forEach(x => console.log(x.id, x.members));
			wrigglerRole.members.map(async m => {
				console.log('Checking', m.id);
				const time = Date.now();
				// Wrigglers older than thirty days are mature
				if (time - m.joinedAt > (1000 * 60 * 60 * 24 * 30)) {
					console.log('Found someone! Time to remove the role for', m.id, '!');
					m.roles.remove(process.env.WRIGGLER_ROLE_ID);
				}
			});
		} catch (DiscordjsError) {
			console.log('Something went wrong when trying to clean up roles for old wrigglers.');
		}
	},
);
wrigglerRemovalJob.start();