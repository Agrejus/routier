import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const playerSchema = s
    .define("players", {
        _id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

const playerMatchSchema = s
    .define("playerMatches", {
        _id: s.string().key().identity(),
        playerId: s.string(),
        score: s.number(),
    })
    .compile();

export class LeagueStore extends DataStore {
    players = this.collection(playerSchema).proxy().create();
    playerMatches = this.collection(playerMatchSchema).proxy().create();

    constructor() {
        super(new MemoryPlugin("league"));
    }
}

export const playersWithMatches = (ctx: LeagueStore) =>
    ctx.players
        .groupJoin((s) => s.playerMatches, (p) => p._id, (m) => m.playerId)
        .sort(([player]) => player.name)
        .map(([player, matches]) => ({
            ...player,
            matches,
            best: Math.max(0, ...matches.map((m) => m.score)),
        }))
        .toArrayAsync();
