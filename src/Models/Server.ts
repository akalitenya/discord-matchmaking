import Model from "./BaseModel"
import Match from "./Match"
import User from "./User"
import ServerCreated from "../Events/ServerCreated"
import gameServerManager from "../Server/gameServerManager"
import firestore from "../firestore"
import moment from "moment"

export default class Server extends Model {
    public id: number
    public status: string
    public destroyed_at: string
    public serverIP: string
    public password: string
    public name: string
    public ip: string
    public user_id: number
    public rcon: string
    public slots: number
    public creation_request_at: string
    public destroy_at: string
    public provisioned_at: string

    static readonly STATUS_CREATING = "creating"
    static readonly STATUS_ONLINE = "online"
    static readonly STATUS_DESTROYING = "destroying"
    static readonly STATUS_DESTROYED = "destroyed"

    static get tableName() {
        return "servers"
    }

    static relationMappings() {
        return {
            providedBy: {
                relation: Model.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: "servers.user_id",
                    to: "users.id",
                },
            },
        }
    }

    static async destroy(match: Match) {
        if (!match) {
            console.log(
                "Unable to destroy server, match not found for server",
                match.id,
            )

            return
        }

        await Server.query()
            .where("id", match.server.id)
            .update({
                status: Server.STATUS_DESTROYING,
            })

        return gameServerManager
            .destroy(match)
            .then(() => {
                return Server.query()
                    .where("id", match.server.id)
                    .update({
                        destroyed_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                        status: Server.STATUS_DESTROYED,
                    })
            })
            .catch((e: Error) => {
                console.log(e.stack)
            })
    }

    getMatch() {
        return Match.query()
            .eager("[server.providedBy]")
            .findOne("server_id", this.id)
    }

    static async createForMatch(match) {
        if (match.hasServerAssigned()) {
            console.log(
                `This match already has server assigned: #${
                    match.id
                } - Server #${match.serverId}`,
            )
            return
        }

        const serverName = match.getServerName()

        console.log(`Creating server for match #${match.id} (${serverName})...`)

        const server = await Server.query().insertGraph({
            name: serverName,
            creation_request_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            status: Server.STATUS_CREATING,
        })

        await Match.query()
            .update({
                server_id: server.id,
            })
            .where("id", match.id)

        return gameServerManager
            .create(serverName, {
                id: match.id,
                maps: match.maps.split(","),
                slots: match.maxPlayers + 2,
            })
            .then(async () => {
                const gameServersCollection = firestore
                    .getClient()
                    .collection("gameservers")

                gameServersCollection
                    .where("name", "==", serverName) // server name allows us to distinguish between dev/prod
                    .where("status", "==", Server.STATUS_ONLINE) // Set by the provisioning script
                    .onSnapshot(
                        async docSnapshot => {
                            if (docSnapshot.empty) {
                                return
                            }

                            // Be careful, some data (like id) does not reflect Server but Match
                            const provisionedMatchServer = docSnapshot.docs[0].data()

                            await Server.query()
                                .update({
                                    ip: provisionedMatchServer.ip,
                                    password: provisionedMatchServer.password,
                                    rcon: provisionedMatchServer.rcon,
                                    slots: provisionedMatchServer.slots,
                                    provisioned_at: moment().format(
                                        "YYYY-MM-DD HH:mm:ss",
                                    ),
                                    status: Server.STATUS_ONLINE,
                                    destroy_at: moment()
                                        .add("1", "hour")
                                        .add("15", "minutes")
                                        .format("YYYY-MM-DD HH:mm:ss"),
                                })
                                .where("id", server.id)

                            console.log(
                                `Created Server #${server.id}. For Match #${
                                    match.id
                                }`,
                            )

                            const matchWithServer = await Match.getFullMatchById(
                                match.id,
                            )

                            new ServerCreated({
                                match: matchWithServer,
                            })
                        },
                        err => {
                            console.log(`Encountered error: ${err}`)
                        },
                    )
            })
            .catch(e => {
                console.log("Error server creation", e)

                throw e
            })
    }
}
