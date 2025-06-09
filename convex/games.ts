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
      const user = await ctx.db
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
    const game = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "lobby"))
      .first();

    let gameId: Id<"games">;

    const isNateStrum = playerName === "Nate Strum";

    if (!game) {
      // Create game first without host
      gameId = await ctx.db.insert("games", {
        status: "lobby",
        roundTimeMinutes: 5,
        bombTimeSeconds: 120,
        bombStatus: "not_planted",
      });

      // Create the player (host if first player OR if Nate Strum)
      const playerId = await ctx.db.insert("players", {
        gameId,
        userId,
        sessionId: identity ? undefined : sessionId,
        name: playerName,
        team,
        isAlive: true,
        isHost: true, // First player is always host initially
      });

      // Update the game with the host player
      await ctx.db.patch(gameId, { hostPlayerId: playerId });
    } else {
      gameId = game._id;
      
      // Check if Nate Strum is joining an existing game
      if (isNateStrum) {
        // Nate Strum takes over as host
        const existingPlayers = await ctx.db
          .query("players")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();
        
        // Remove host status from all existing players
        for (const existingPlayer of existingPlayers) {
          await ctx.db.patch(existingPlayer._id, { isHost: false });
        }
        
        // Add Nate Strum as the new host
        const playerId = await ctx.db.insert("players", {
          gameId: game._id,
          userId,
          sessionId: identity ? undefined : sessionId,
          name: playerName,
          team,
          isAlive: true,
          isHost: true,
        });
        
        // Update game to point to new host
        await ctx.db.patch(game._id, { hostPlayerId: playerId });
      } else {
        // Regular player joining existing game
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
      // Reset bomb status for new round
      bombStatus: "not_planted",
      bombPlantTime: undefined,
      bombExplodeTime: undefined,
      bombPlantedBy: undefined,
      bombDefusedBy: undefined,
      winner: undefined,
      winReason: undefined,
      roundDuration: undefined,
    });
  },
});

// Helper function to check win conditions
const checkWinConditions = async (ctx: MutationCtx, gameId: Id<"games">) => {
  const game = await ctx.db.get(gameId);
  if (!game || game.status !== "active") return;

  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();

  const aliveTerrorists = players.filter(p => p.team === "terrorist" && p.isAlive);
  const aliveCounterTerrorists = players.filter(p => p.team === "counter_terrorist" && p.isAlive);

  let winner: "terrorist" | "counter_terrorist" | "draw" | null = null;
  let winReason = "";

  // Check bomb-related wins first
  if (game.bombStatus === "exploded") {
    winner = "terrorist";
    winReason = "Bomb exploded";
  } else if (game.bombStatus === "defused") {
    winner = "counter_terrorist";
    winReason = "Bomb defused";
  }
  
  // Check bomb explosion due to time
  const now = Date.now();
  if (game.bombStatus === "planted" && game.bombExplodeTime && now >= game.bombExplodeTime) {
    winner = "terrorist";
    winReason = "Bomb exploded";
    // Update bomb status
    await ctx.db.patch(gameId, { bombStatus: "exploded" });
  }

  // If no bomb-related win, check elimination wins
  if (!winner) {
    if (aliveTerrorists.length === 0 && aliveCounterTerrorists.length === 0) {
      winner = "draw";
      winReason = "Both teams eliminated";
    } else if (aliveTerrorists.length === 0) {
      winner = "counter_terrorist";
      winReason = "All terrorists eliminated";
    } else if (aliveCounterTerrorists.length === 0) {
      winner = "terrorist";
      winReason = "All counter-terrorists eliminated";
    }
  }

  // Check time expiration win (only if no bomb-related or elimination win)
  if (!winner && game.roundEndTime && now >= game.roundEndTime) {
    if (aliveTerrorists.length > 0 && aliveCounterTerrorists.length === 0) {
      winner = "terrorist";
      winReason = "Time expired - terrorists survive";
    } else if (aliveCounterTerrorists.length > 0 && aliveTerrorists.length === 0) {
      winner = "counter_terrorist";
      winReason = "Time expired - counter-terrorists survive";
    } else if (aliveTerrorists.length > 0 && aliveCounterTerrorists.length > 0) {
      winner = "draw";
      winReason = "Time expired - both teams survive";
    } else {
      winner = "terrorist";
      winReason = "Time expired - terrorists win by default";
    }
  }

  // End the round if there's a winner
  if (winner) {
    const roundDuration = game.roundStartTime ? now - game.roundStartTime : 0;
    await ctx.db.patch(gameId, {
      status: "finished",
      winner,
      winReason,
      roundDuration,
    });
  }
};

export const markPlayerDead = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "active") throw new ConvexError("No active round");

    await ctx.db.patch(player._id, { isAlive: false });
    
    // Check if this death ends the round
    await checkWinConditions(ctx, game._id);
  },
});

// Check for time expiration wins
export const checkTimeExpiration = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");

    await checkWinConditions(ctx, game._id);
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
        // Look for "Nate Strum" among remaining players, otherwise use first player
        const nateStrum = remainingPlayers.find(p => p.name === "Nate Strum");
        const newHost = nateStrum || remainingPlayers[0];
        
        await ctx.db.patch(newHost._id, { isHost: true });
        await ctx.db.patch(game._id, { hostPlayerId: newHost._id });
      }
    }
  },
});

export const plantBomb = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "active") throw new ConvexError("No active round");
    
    // Validate player can plant bomb
    if (player.team !== "terrorist") throw new ConvexError("Only terrorists can plant the bomb");
    if (!player.isAlive) throw new ConvexError("Dead players cannot plant the bomb");
    if (game.bombStatus === "planted") throw new ConvexError("Bomb is already planted");
    if (game.bombStatus === "exploded") throw new ConvexError("Bomb has already exploded");
    if (game.bombStatus === "defused") throw new ConvexError("Bomb has already been defused");

    const now = Date.now();
    const bombExplodeTime = now + (game.bombTimeSeconds * 1000);

    await ctx.db.patch(game._id, {
      bombStatus: "planted",
      bombPlantTime: now,
      bombExplodeTime,
      bombPlantedBy: player._id,
    });

    // Check win conditions in case this changes anything
    await checkWinConditions(ctx, game._id);
  },
});

export const defuseBomb = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const player = await getCurrentPlayer(ctx, sessionId);
    if (!player) throw new ConvexError("Not in a game");

    const game = await ctx.db.get(player.gameId);
    if (!game) throw new ConvexError("Game not found");
    if (game.status !== "active") throw new ConvexError("No active round");
    
    // Validate player can defuse bomb
    if (player.team !== "counter_terrorist") throw new ConvexError("Only counter-terrorists can defuse the bomb");
    if (!player.isAlive) throw new ConvexError("Dead players cannot defuse the bomb");
    if (game.bombStatus !== "planted") throw new ConvexError("No bomb planted to defuse");
    
    // Check if bomb has already exploded
    const now = Date.now();
    if (game.bombExplodeTime && now >= game.bombExplodeTime) {
      throw new ConvexError("Bomb has already exploded");
    }

    await ctx.db.patch(game._id, {
      bombStatus: "defused",
      bombDefusedBy: player._id,
    });

    // Check win conditions - defusing the bomb should trigger a CT win
    await checkWinConditions(ctx, game._id);
  },
});

