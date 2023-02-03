import config from '../../config.ts';
import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	Bot,
	botId,
	ButtonStyles,
	ChannelTypes,
	DiscordEmbedField,
	Interaction,
	InteractionResponseTypes,
	MessageComponentTypes,
	OverwriteTypes,
	sendMessage,
} from '../../deps.ts';
import { failColor, infoColor2, somethingWentWrong, successColor, safelyDismissMsg } from '../commandUtils.ts';
import { dbClient, lfgChannelSettings, queries } from '../db.ts';
import { CommandDetails } from '../types/commandTypes.ts';
import utils from '../utils.ts';
import { customId as gameSelId } from '../buttons/event-creation/step1-gameSelection.ts';

const withoutMgrRole = 'without-manager-role';
const withMgrRole = 'with-manager-role';
const managerRoleStr = 'manager-role';
const logChannelStr = 'log-channel';

const details: CommandDetails = {
	name: 'setup',
	description: `Configures this channel to be a dedicated event channel to be managed by ${config.name}.`,
	type: ApplicationCommandTypes.ChatInput,
	defaultMemberPermissions: ['ADMINISTRATOR'],
	options: [
		{
			name: withoutMgrRole,
			type: ApplicationCommandOptionTypes.SubCommand,
			description: `This will configure ${config.name} without a manager role.`,
		},
		{
			name: withMgrRole,
			type: ApplicationCommandOptionTypes.SubCommand,
			description: `This will configure ${config.name} with a manager role.`,
			options: [
				{
					name: managerRoleStr,
					type: ApplicationCommandOptionTypes.Role,
					description: 'This role will be allowed to manage all events in this guild.',
					required: true,
				},
				{
					name: logChannelStr,
					type: ApplicationCommandOptionTypes.Channel,
					description: `This channel is where ${config.name} will send Audit Messages whenever a manager updates an event.`,
					required: true,
					channelTypes: [ChannelTypes.GuildText],
				},
			],
		},
	],
};

const execute = async (bot: Bot, interaction: Interaction) => {
	dbClient.execute(queries.callIncCnt('cmd-setup')).catch((e) => utils.commonLoggers.dbError('setup.ts', 'call sproc INC_CNT on', e));

	const setupOpts = interaction.data?.options?.[0];

	if (setupOpts?.name && interaction.channelId && interaction.guildId) {
		if (lfgChannelSettings.has(`${interaction.guildId}-${interaction.channelId}`)) {
			// Cannot setup a lfg channel that is already set up
			bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						color: failColor,
						title: 'Unable to setup LFG channel.',
						description:
							'This channel is already set as an LFG channel.  If you need to edit the channel, please run `/delete lfg-channel` in this channel and then run `/setup` again.\n\nThis will not harm any active events in this channel and simply resets the settings for this channel.',
					}],
				},
			}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
			return;
		}

		const messages = await bot.helpers.getMessages(interaction.channelId, { limit: 100 });
		if (messages.size < 100) {
			let logChannelId = 0n;
			let managerRoleId = 0n;
			let logChannelErrorOut = false;
			let mgrRoleErrorOut = false;
			const introFields: Array<DiscordEmbedField> = [{
				name: 'Editing/Deleting your event:',
				value: 'To edit or delete your event, simply click on the ✏️ or 🗑️ buttons respectively.',
			}];
			const permissionFields: Array<DiscordEmbedField> = [
				{
					name: `Please make sure ${config.name} has the following permissions:`,
					value: '`MANAGE_GUILD`\n`MANAGE_CHANNELS`\n`MANAGE_ROLES`\n`MANAGE_MESSAGES`\n\nThe only permission that is required after setup completes is `MANAGE_MESSAGES`.',
				},
			];
			if (setupOpts.name === withMgrRole) {
				introFields.push({
					name: `${config.name} Manager Details:`,
					value: `${config.name} Managers with the <@&${managerRoleId}> role may edit or delete events in this guild, along with using the following commands to update the activity members:

\`/join\`
\`/leave\`
\`/alternate\`

The Discord Slash Command system will ensure you provide all the required details.`,
				});
				if (setupOpts.options?.length) {
					setupOpts.options.forEach((opt) => {
						if (opt.name === managerRoleStr) {
							managerRoleId = BigInt(opt.value as string || '0');
						} else if (opt.name === logChannelStr) {
							logChannelId = BigInt(opt.value as string || '0');
						}
					});

					if (logChannelId === 0n || managerRoleId === 0n) {
						// One or both Ids did not get parsed
						bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
							type: InteractionResponseTypes.ChannelMessageWithSource,
							data: {
								flags: ApplicationCommandFlags.Ephemeral,
								embeds: [{
									color: failColor,
									title: 'Unable to setup log channel or manager role.',
									description:
										`${config.name} attempted to set the log channel or manager role, but one or both were undefined.  Please try again and if the issue continues, \`/report\` this issue to the developers with the error code below.`,
									fields: [{
										name: 'Error Code:',
										value: `setupLog${logChannelId}Mgr${managerRoleId}`,
									}],
								}],
							},
						}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
						return;
					}
				} else {
					// Discord broke?
					somethingWentWrong(bot, interaction, 'setupMissingRoleMgrOptions');
					return;
				}

				// Test sending a message to the logChannel
				await sendMessage(bot, logChannelId, {
					embeds: [{
						title: `This is the channel ${config.name} will be logging events to.`,
						description: `${config.name} will only send messages here as frequently as your event managers update events.`,
						color: infoColor2,
					}],
				}).catch((e: Error) => {
					utils.commonLoggers.messageSendError('setup.ts', 'log-test', e);
					logChannelErrorOut = true;
				});
				if (logChannelErrorOut) {
					// Cannot send message into log channel, error out
					bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
						type: InteractionResponseTypes.ChannelMessageWithSource,
						data: {
							flags: ApplicationCommandFlags.Ephemeral,
							embeds: [{
								color: failColor,
								title: 'Unable to setup log channel.',
								description: `${config.name} attempted to send a message to the specified log channel.`,
								fields: [
									{
										name: `Please allow ${config.name} to send messages in the requested channel.`,
										value: `${config.name}`,
									},
								],
							}],
						},
					}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
					return;
				}

				// Set permissions for managerId
				await bot.helpers.editChannelPermissionOverrides(interaction.channelId, {
					id: managerRoleId,
					type: OverwriteTypes.Role,
					allow: ['SEND_MESSAGES'],
				}).catch((e: Error) => {
					utils.commonLoggers.channelUpdateError('setup.ts', 'manager-allow', e);
					mgrRoleErrorOut = true;
				});
			}

			// Set permissions for everyone, skip if we already failed to set roles
			!mgrRoleErrorOut && await bot.helpers.editChannelPermissionOverrides(interaction.channelId, {
				id: interaction.guildId,
				type: OverwriteTypes.Role,
				deny: ['SEND_MESSAGES'],
			}).catch((e: Error) => {
				utils.commonLoggers.channelUpdateError('setup.ts', 'everyone-deny', e);
				mgrRoleErrorOut = true;
			});

			if (mgrRoleErrorOut) {
				// Cannot update role overrides on channel, error out
				bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							color: failColor,
							title: 'Unable to set lfg channel permissions.',
							description: `${config.name} attempted to update the permissions for the current channel, but could not.`,
							fields: permissionFields,
						}],
					},
				}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
				return;
			}

			// Delete all messages that are not LFG posts
			const msgsToDel: Array<bigint> = [];
			const oldLfgMsgs: Array<bigint> = [];
			messages.forEach((msg) => {
				if (msg.authorId === botId && msg.embeds.length && msg.embeds[0].footer && msg.embeds[0].footer.text.includes('Created by:')) {
					oldLfgMsgs.push(msg.id);
				} else {
					msgsToDel.push(msg.id);
				}
			});
			if (msgsToDel.length) {
				await bot.helpers.deleteMessages(interaction.channelId, msgsToDel, 'Cleaning LFG Channel').catch((e: Error) => utils.commonLoggers.messageDeleteError('setup.ts', 'bulk-msg-cleanup', e));
			}

			// Retrofit all old LFG posts that we found
			if (oldLfgMsgs.length) {
				// TODO: Retrofit old LFG posts, should delete ones that have already passed, should begin watching these events
			}

			// Store the ids to the db
			let dbErrorOut = false;
			await dbClient.execute('INSERT INTO guild_settings(guildId,lfgChannelId,managerRoleId,logChannelId) values(?,?,?,?)', [interaction.guildId, interaction.channelId, managerRoleId, logChannelId])
				.catch((e) => {
					utils.commonLoggers.dbError('setup.ts', 'insert into guild_settings', e);
					dbErrorOut = true;
				});
			if (dbErrorOut) {
				// DB died?
				somethingWentWrong(bot, interaction, 'setupDBInsertFailed');
				return;
			}
			// Store the ids to the active map
			lfgChannelSettings.set(`${interaction.guildId}-${interaction.channelId}`, {
				managed: setupOpts.name === withMgrRole,
				managerRoleId,
				logChannelId,
			});

			// Send the initial introduction message
			const createNewEventBtn = 'Create New Event';
			const introMsg = await sendMessage(bot, interaction.channelId, {
				content: `Welcome to <#${interaction.channelId}>, managed by <@${botId}>!`,
				embeds: [{
					title: `To get started, click on the '${createNewEventBtn}' button below!`,
					color: successColor,
					fields: introFields,
				}],
				components: [{
					type: MessageComponentTypes.ActionRow,
					components: [{
						type: MessageComponentTypes.Button,
						label: createNewEventBtn,
						customId: gameSelId,
						style: ButtonStyles.Success,
					}],
				}],
			}).catch((e: Error) => utils.commonLoggers.messageSendError('setup.ts', 'init-msg', e));

			if (introMsg) {
				bot.helpers.pinMessage(interaction.channelId, introMsg.id).catch((e: Error) => utils.commonLoggers.messageSendError('setup.ts', 'pin-init-msg', e));
				// Complete the interaction
				bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							color: successColor,
							title: 'LFG Channel setup complete!',
							description: `${config.name} has finished setting up this channel.  ${safelyDismissMsg}`,
						}],
					},
				}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
			} else {
				// Could not send initial message
				bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							color: failColor,
							title: 'Failed to send the initial message!',
							fields: permissionFields,
						}],
					},
				}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
			}
		} else {
			// Too many messages to delete, give up
			bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						color: failColor,
						title: 'Unable to setup LFG channel.',
						description: `${config.name} attempted to clean this channel, but encountered too many messages (100 or more).  There are two ways to move forward:`,
						fields: [
							{
								name: 'Is this channel a dedicated LFG Channel?',
								value: 'You either need to manually clean this channel or create a brand new channel for events.',
								inline: true,
							},
							{
								name: 'Is this a chat channel that you want events mixed into?',
								value: 'You do not need to run the `/setup` command, and instead should use the `/lfg create` command.',
								inline: true,
							},
						],
					}],
				},
			}).catch((e: Error) => utils.commonLoggers.interactionSendError('setup.ts', interaction, e));
		}
	} else {
		// Discord fucked up?
		somethingWentWrong(bot, interaction, 'setupMissingAllOptions');
	}
};

export default {
	details,
	execute,
};
