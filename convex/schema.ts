import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.optional(v.string()), // optional for anonymous users
    name: v.string(),
    isAnonymous: v.boolean(),
  }).index("by_clerkId", ["clerkId"]),

  games: defineTable({
    hostPlayerId: v.optional(v.id("players")), // reference to player who is host
    status: v.union(v.literal("lobby"), v.literal("active"), v.literal("finished")),
    roundTimeMinutes: v.number(), // 1-20 minutes
    bombTimeSeconds: v.number(), // 40-300 seconds
    roundStartTime: v.optional(v.number()), // timestamp when round started
    roundEndTime: v.optional(v.number()), // when round will end
    winner: v.optional(v.union(v.literal("terrorist"), v.literal("counter_terrorist"), v.literal("draw"))),
    winReason: v.optional(v.string()), // "elimination", "time_expired", etc.
    roundDuration: v.optional(v.number()), // actual round duration in ms
  }),

  players: defineTable({
    gameId: v.id("games"),
    userId: v.optional(v.id("users")), // optional for session-based players
    sessionId: v.optional(v.string()), // for anonymous users
    name: v.string(), // player display name
    team: v.union(v.literal("terrorist"), v.literal("counter_terrorist")),
    isAlive: v.boolean(),
    isHost: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_session_game", ["sessionId", "gameId"]),
});
