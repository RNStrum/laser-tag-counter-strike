import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./users";

export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Find the user's current game
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (!player) return null;

    const game = await ctx.db.get(player.gameId);
    if (!game) return null;

    // Get all players in this game
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    // Get user info for each player
    const playersWithUsers = await Promise.all(
      players.map(async (player) => {
        const user = await ctx.db.get(player.userId);
        return { ...player, user };
      })
    );

    return {
      ...game,
      players: playersWithUsers,
      currentPlayer: player,
    };
  },
});

export const createOrJoinGame = mutation({
  args: {
    team: v.union(v.literal("terrorist"), v.literal("counter_terrorist")),
  },
  handler: async (ctx, { team }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError("Must be authenticated");

    // Check if user is already in a game
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (existingPlayer) {
      throw new ConvexError("Already in a game");
    }

    // Find an existing lobby game or create new one
    let game = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "lobby"))
      .first();

    let isHost = false;

    if (!game) {
      // Create new game with default settings
      const gameId = await ctx.db.insert("games", {
        hostId: user._id,
        status: "lobby",
        roundTimeMinutes: 5,
        bombTimeSeconds: 120,
      });
      game = await ctx.db.get(gameId);
      isHost = true;
    }

    if (!game) throw new ConvexError("Failed to create game");

    // Add player to game
    await ctx.db.insert("players", {
      gameId: game._id,
      userId: user._id,
      team,
      isAlive: true,
      isHost,
    });

    return game._id;
  },
});

export const updateGameSettings = mutation({
  args: {
    roundTimeMinutes: v.number(),
    bombTimeSeconds: v.number(),
  },
  handler: async (ctx, { roundTimeMinutes, bombTimeSeconds }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError("Must be authenticated");

    // Validate ranges
    if (roundTimeMinutes < 1 || roundTimeMinutes > 20) {
      throw new ConvexError("Round time must be between 1-20 minutes");
    }
    if (bombTimeSeconds < 40 || bombTimeSeconds > 300) {
      throw new ConvexError("Bomb time must be between 40-300 seconds");
    }

    // Find user's game
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (!player) throw new ConvexError("Not in a game");
    if (!player.isHost) throw new ConvexError("Only host can change settings");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "lobby") throw new ConvexError("Cannot change settings during active game");

    await ctx.db.patch(game._id, {
      roundTimeMinutes,
      bombTimeSeconds,
    });
  },
});

export const startRound = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError("Must be authenticated");

    // Find user's game
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (!player) throw new ConvexError("Not in a game");
    if (!player.isHost) throw new ConvexError("Only host can start round");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status === "active") throw new ConvexError("Round already active");

    const now = Date.now();
    const roundEndTime = now + (game.roundTimeMinutes * 60 * 1000);

    // Reset all players to alive
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    for (const player of players) {
      await ctx.db.patch(player._id, { isAlive: true });
    }

    await ctx.db.patch(game._id, {
      status: "active",
      roundStartTime: now,
      roundEndTime,
    });
  },
});

export const markPlayerDead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError("Must be authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "active") throw new ConvexError("No active round");

    await ctx.db.patch(player._id, { isAlive: false });
  },
});

export const leaveGame = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError("Must be authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_game", (q) => q.eq("userId", user._id))
      .first();

    if (!player) return; // Not in a game

    const game = await ctx.db.get(player.gameId);
    if (!game) return;

    // Remove player
    await ctx.db.delete(player._id);

    // If this was the host, make someone else host or delete game
    if (player.isHost) {
      const remainingPlayers = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      if (remainingPlayers.length === 0) {
        // Delete empty game
        await ctx.db.delete(game._id);
      } else {
        // Make first remaining player the host
        await ctx.db.patch(remainingPlayers[0]._id, { isHost: true });
        await ctx.db.patch(game._id, { hostId: remainingPlayers[0].userId });
      }
    }
  },
});