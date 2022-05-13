export const config = {
	"name": "Group Up", // Name of the bot
	"version": "0.5.5", // Version of the bot
	"token": "the_bot_token", // Discord API Token for this bot
	"localtoken": "local_testing_token", // Discord API Token for a secondary OPTIONAL testing bot, THIS MUST BE DIFFERENT FROM "token"
	"prefix": "gu!", // Prefix for all commands
	"db": { // Settings for the MySQL database, this is required for use with the API, if you do not want to set this up, you will need to rip all code relating to the DB out of the bot
		"host": "", // IP address for the db, usually localhost
		"localhost": "", // IP address for a secondary OPTIONAL local testing DB, usually also is localhost, but depends on your dev environment
		"port": 3306, // Port for the db
		"username": "", // Username for the account that will access your DB, this account will need "DB Manager" admin rights and "REFERENCES" Global Privalages
		"password": "", // Password for the account, user account may need to be authenticated with the "Standard" Authentication Type if this does not work out of the box
		"name": "" // Name of the database Schema to use for the bot
	},
	"logChannel": "the_log_channel", // Discord channel ID where the bot should put startup messages and other error messages needed
	"reportChannel": "the_report_channel", // Discord channel ID where reports will be sent when using the built-in report command
	"devServer": "the_dev_server", // Discord guild ID where testing of indev features/commands will be handled, used in conjuction with the DEVMODE bool in mod.ts
	"owner": "the_bot_owner", // Discord user ID of the bot admin
	"botLists": [ // Array of objects containing all bot lists that stats should be posted to
		{ // Bot List object, duplicate for each bot list
			"name": "Bot List Name", // Name of bot list, not used
			"enabled": false, // Should statistics be posted to this list?
			"apiUrl": "https://example.com/api/bots/?{bot_id}/stats", // API URL, use ?{bot_id} in place of the bot id so that it can be dynamically replaced
			"headers": [ // Array of headers that need to be added to the request
				{ // Header Object, duplicate for every header needed
					"header": "header_name", // Name of header needed, usually Authorization is needed
					"value": "header_value" // Value for the header
				}
			],
			"body": { // Data payload to send to the bot list, will be turned into a string and any ?{} will be replaced with the required value, currently only has ?{server_count}
				"param_name": "?{param_value}" // Add more params as needed
			}
		}
	]
};

export default config;
