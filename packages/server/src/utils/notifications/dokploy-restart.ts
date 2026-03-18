import { db } from "@dokploy/server/db";
import { notifications } from "@dokploy/server/db/schema";
import ServerRestartEmail from "@dokploy/server/emails/emails/dokploy-restart";
import { renderAsync } from "@react-email/components";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import {
	sendCustomNotification,
	sendDiscordNotification,
	sendEmailNotification,
	sendGotifyNotification,
	sendLarkNotification,
	sendNtfyNotification,
	sendPushoverNotification,
	sendResendNotification,
	sendSlackNotification,
	sendTeamsNotification,
	sendTelegramNotification,
} from "./utils";

export const sendServerRestartNotifications = async () => {
	try {
		const date = new Date();
		const unixDate = ~~(Number(date) / 1000);
		const notificationList = await db.query.notifications.findMany({
			where: eq(notifications.dokployRestart, true),
			with: {
				email: true,
				discord: true,
				telegram: true,
				slack: true,
				resend: true,
				gotify: true,
				ntfy: true,
				custom: true,
				lark: true,
				pushover: true,
				teams: true,
			},
		});

		for (const notification of notificationList) {
			const {
				email,
				resend,
				discord,
				telegram,
				slack,
				gotify,
				ntfy,
				custom,
				lark,
				pushover,
				teams,
			} = notification;

			try {
				if (email || resend) {
					const template = await renderAsync(
						ServerRestartEmail({ date: date.toLocaleString() }),
					).catch();

					if (email) {
						await sendEmailNotification(
							email,
							"AgentReady Server Restarted",
							template,
						);
					}

					if (resend) {
						await sendResendNotification(
							resend,
							"AgentReady Server Restarted",
							template,
						);
					}
				}

				if (discord) {
					const decorate = (decoration: string, text: string) =>
						`${discord.decoration ? decoration : ""} ${text}`.trim();

					await sendDiscordNotification(discord, {
						title: decorate(">", "`[OK]` AgentReady Server Restarted"),
						color: 0x57f287,
						fields: [
							{
								name: decorate("`[DATE]`", "Date"),
								value: `<t:${unixDate}:D>`,
								inline: true,
							},
							{
								name: decorate("`[TIME]`", "Time"),
								value: `<t:${unixDate}:t>`,
								inline: true,
							},
							{
								name: decorate("`[?]`", "Type"),
								value: "Successful",
								inline: true,
							},
						],
						timestamp: date.toISOString(),
						footer: {
							text: "AgentReady restart notification",
						},
					});
				}

				if (gotify) {
					const decorate = (decoration: string, text: string) =>
						`${gotify.decoration ? decoration : ""} ${text}\n`;
					await sendGotifyNotification(
						gotify,
						decorate("[OK]", "AgentReady Server Restarted"),
						`${decorate("[CLOCK]", `Date: ${date.toLocaleString()}`)}`,
					);
				}

				if (ntfy) {
					await sendNtfyNotification(
						ntfy,
						"AgentReady Server Restarted",
						"white_check_mark",
						"",
						`[CLOCK]Date: ${date.toLocaleString()}`,
					);
				}

				if (telegram) {
					await sendTelegramNotification(
						telegram,
						`<b>[OK] AgentReady Server Restarted</b>\n\n<b>Date:</b> ${format(
							date,
							"PP",
						)}\n<b>Time:</b> ${format(date, "pp")}`,
					);
				}

				if (slack) {
					const { channel } = slack;
					await sendSlackNotification(slack, {
						channel: channel,
						attachments: [
							{
								color: "#00FF00",
								pretext: ":white_check_mark: *AgentReady Server Restarted*",
								fields: [
									{
										title: "Time",
										value: date.toLocaleString(),
										short: true,
									},
								],
							},
						],
					});
				}

				if (custom) {
					try {
						await sendCustomNotification(custom, {
							title: "AgentReady Server Restarted",
							message: "AgentReady server has been restarted successfully",
							timestamp: date.toISOString(),
							date: date.toLocaleString(),
							status: "success",
							type: "server-restart",
						});
					} catch (error) {
						console.log(error);
					}
				}

				if (lark) {
					await sendLarkNotification(lark, {
						msg_type: "interactive",
						card: {
							schema: "2.0",
							config: {
								update_multi: true,
								style: {
									text_size: {
										normal_v2: {
											default: "normal",
											pc: "normal",
											mobile: "heading",
										},
									},
								},
							},
							header: {
								title: {
									tag: "plain_text",
									content: "[OK] AgentReady Server Restarted",
								},
								subtitle: {
									tag: "plain_text",
									content: "",
								},
								template: "green",
								padding: "12px 12px 12px 12px",
							},
							body: {
								direction: "vertical",
								padding: "12px 12px 12px 12px",
								elements: [
									{
										tag: "column_set",
										columns: [
											{
												tag: "column",
												width: "weighted",
												elements: [
													{
														tag: "markdown",
														content: "**Status:**\nSuccessful",
														text_align: "left",
														text_size: "normal_v2",
													},
												],
												vertical_align: "top",
												weight: 1,
											},
											{
												tag: "column",
												width: "weighted",
												elements: [
													{
														tag: "markdown",
														content: `**Restart Time:**\n${format(
															date,
															"PP pp",
														)}`,
														text_align: "left",
														text_size: "normal_v2",
													},
												],
												vertical_align: "top",
												weight: 1,
											},
										],
									},
								],
							},
						},
					});
				}

				if (pushover) {
					await sendPushoverNotification(
						pushover,
						"AgentReady Server Restarted",
						`Date: ${date.toLocaleString()}`,
					);
				}

				if (teams) {
					await sendTeamsNotification(teams, {
						title: "[OK] AgentReady Server Restarted",
						facts: [
							{ name: "Status", value: "Successful" },
							{ name: "Restart Time", value: format(date, "PP pp") },
						],
					});
				}
			} catch (error) {
				console.log(error);
			}
		}
	} catch (error) {
		console.error("[AgentReady] Restart notifications failed:", error);
	}
};
