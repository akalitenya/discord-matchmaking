import DeletedMatch from "./DeletedMatch"
import Match from "../Models/Match"

export default class DeletedMatchDueToDesertion extends DeletedMatch {
    constructor(match: Match) {
        match.sendToChannel(`Match #${match.id} is empty...`)

        super({ match })
    }
}
