import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper function to find current player
const getCurrentPlayer = async (ctx: QueryCtx | MutationCtx, sessionId?: string) => {
  const identity = await ctx.auth.getUserIdentity();
  
  if (identity) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user) {
      return await ctx.db
        .query("players")
        .filter((q) => q.eq(q.field("userId"), user._id))
        .first();
    }
  } else if (sessionId) {
    return await ctx.db
      .query("players")
      .withIndex("by_session_game", (q) => q.eq("sessionId", sessionId))
      .first();
  }
  
  return null;
};

export const getCurrentGame = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) return null;

    const game = await ctx.db.get(player.gameId);
    if (!game) return null;

    // Get all players in this game
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    return {
      ...game,
      players,
      currentPlayer: player,
    };
  },
});

export const createOrJoinGame = mutation({
  args: {
    team: v.union(v.literal("terrorist"), v.literal("counter_terrorist")),
    playerName: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { team, playerName, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    
    let userId: Id<"users"> | undefined = undefined;
    
    // Handle authenticated users
    if (identity) {
      let user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
      
      if (!user) {
        // Create authenticated user
        userId = await ctx.db.insert("users", {
          clerkId: identity.subject,
          name: identity.name ?? playerName,
          isAnonymous: false,
        });
      } else {
        userId = user._id;
      }
      
      // Check if user is already in a game
      const existingPlayer = await ctx.db
        .query("players")
        .filter((q) => q.eq(q.field("userId"), userId))
        .first();
      
      if (existingPlayer) {
        throw new ConvexError("Already in a game");
      }
    } else if (sessionId) {
      // Check if anonymous user is already in a game
      const existingPlayer = await ctx.db
        .query("players")
        .withIndex("by_session_game", (q) => q.eq("sessionId", sessionId))
        .first();
      
      if (existingPlayer) {
        throw new ConvexError("Already in a game");
      }
    } else {
      throw new ConvexError("Must provide sessionId for anonymous users");
    }

    // Find an existing lobby game
    let game = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "lobby"))
      .first();

    let isHost = false;
    let gameId: Id<"games">;

    if (!game) {
      isHost = true;
      // Create game first without host
      gameId = await ctx.db.insert("games", {
        status: "lobby",
        roundTimeMinutes: 5,
        bombTimeSeconds: 120,
      });

      // Create the host player
      const playerId = await ctx.db.insert("players", {
        gameId,
        userId,
        sessionId: identity ? undefined : sessionId,
        name: playerName,
        team,
        isAlive: true,
        isHost: true,
      });

      // Update the game with the host player
      await ctx.db.patch(gameId, { hostPlayerId: playerId });
    } else {
      gameId = game._id;
      // Add player to existing game
      await ctx.db.insert("players", {
        gameId: game._id,
        userId,
        sessionId: identity ? undefined : sessionId,
        name: playerName,
        team,
        isAlive: true,
        isHost: false,
      });
    }

    return gameId;
  },
});

export const updateGameSettings = mutation({
  args: {
    roundTimeMinutes: v.number(),
    bombTimeSeconds: v.number(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { roundTimeMinutes, bombTimeSeconds, sessionId }) => {
    // Validate ranges
    if (roundTimeMinutes < 1 || roundTimeMinutes > 20) {
      throw new ConvexError("Round time must be between 1-20 minutes");
    }
    if (bombTimeSeconds < 40 || bombTimeSeconds > 300) {
      throw new ConvexError("Bomb time must be between 40-300 seconds");
    }

    // Find player's game
    const player = await getCurrentPlayer(ctx, sessionId);

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
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
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

    for (const gamePlayer of players) {
      await ctx.db.patch(gamePlayer._id, { isAlive: true });
    }

    await ctx.db.patch(game._id, {
      status: "active",
      roundStartTime: now,
      roundEndTime,
    });
  },
});

export const markPlayerDead = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "active") throw new ConvexError("No active round");

    await ctx.db.patch(player._id, { isAlive: false });
  },
});

export const leaveGame = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
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
        await ctx.db.patch(game._id, { hostPlayerId: remainingPlayers[0]._id });
      }
    }
  },
});