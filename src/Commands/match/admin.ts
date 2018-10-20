import { CommandMessage, CommandoClient } from "discord.js-commando"
const Discord = require("discord.js")

import secrets from "../../secrets"
import utils from "../../Utilities/utils"
import Match from "../../Models/Match"
import BaseCommand from "../BaseCommand"

export default class JoinCommand extends BaseCommand {
    constructor(client: CommandoClient) {
        super(client, {
            name: "admin",
            memberName: "admin",
            description: "Admin match info. (Only available for admins)",
            group: "match",

            args: [
                {
                    key: "id",
                    label: "Match ID",
                    prompt: "Match ID",
                    type: "integer",
                },
            ],
        })
    }

    hasPermission(message: CommandMessage) {
        return utils.includes(secrets.discordAdmins, message.author.id)
    }

    async run(message: CommandMessage, { id }: { id: number }) {
        const match = await Match.getFullMatchById(id)

        if (!match) {
            return message.reply("No match with given ID (" + id + ")!")
        }

        const embed = new Discord.RichEmbed().setColor("#ffffff")

        embed.addField(`Match ID`, match.id)

        embed.addField(`Hostname`, match.getServerName())

        embed.addField(
            `Players (${match.players.length}/${match.maxPlayers})`,
            match.playerNames().join(", "),
        )

        embed.addField(`Map`, match.mapNames().join(", "))

        embed.addField(`Ip`, match.server.ip)

        embed.addField(`Password`, match.server.password)

        embed.addField(`Rcon`, match.server.rcon)

        embed.addField(
            "Connect",
            "`" +
                `/connect ${match.server.ip}; password ${
                    match.server.password
                }; rconpassword ${match.server.rcon}` +
                "`",
        )

        embed.addField(`Status`, match.isServerOnline() ? "Online" : "Offline")

        message.author.createDM().then(channel => {
            channel.send(embed)
        })
    }
}
