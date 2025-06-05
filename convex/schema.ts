import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
  }).index("by_clerkId", ["clerkId"]),

  games: defineTable({
    hostId: v.id("users"),
    status: v.union(v.literal("lobby"), v.literal("active"), v.literal("finished")),
    roundTimeMinutes: v.number(), // 1-20 minutes
    bombTimeSeconds: v.number(), // 40-300 seconds
    roundStartTime: v.optional(v.number()), // timestamp when round started
    roundEndTime: v.optional(v.number()), // when round will end
  }),

  players: defineTable({
    gameId: v.id("games"),
    userId: v.id("users"),
    team: v.union(v.literal("terrorist"), v.literal("counter_terrorist")),
    isAlive: v.boolean(),
    isHost: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_user_game", ["userId", "gameId"]),
});
