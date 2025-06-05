import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useMutation } from "convex/react";
import { 
  Clock, 
  Skull, 
  Settings, 
  Play, 
  Users, 
  Target,
  LogOut,
  Timer
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../../convex/_generated/api";

const gameQueryOptions = convexQuery(api.games.getCurrentGame, {});

export const Route = createFileRoute("/game")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(gameQueryOptions);
  },
  component: GamePage,
});

function GamePage() {
  return (
    <>
      <Unauthenticated>
        <div className="text-center">
          <p>Please sign in to access the game.</p>
        </div>
      </Unauthenticated>

      <Authenticated>
        <GameInterface />
      </Authenticated>
    </>
  );
}

function GameInterface() {
  const navigate = useNavigate();
  const { data: gameData } = useSuspenseQuery(gameQueryOptions);
  const markPlayerDead = useMutation(api.games.markPlayerDead);
  const startRound = useMutation(api.games.startRound);
  const updateGameSettings = useMutation(api.games.updateGameSettings);
  const leaveGame = useMutation(api.games.leaveGame);

  const [showSettings, setShowSettings] = useState(false);
  const [roundTime, setRoundTime] = useState(5);
  const [bombTime, setBombTime] = useState(120);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (gameData?.game) {
      setRoundTime(gameData.game.roundTimeMinutes);
      setBombTime(gameData.game.bombTimeSeconds);
    }
  }, [gameData?.game]);

  // Timer countdown
  useEffect(() => {
    if (gameData?.game?.status === "active" && gameData.game.roundEndTime) {
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, gameData.game.roundEndTime! - now);
        setTimeLeft(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [gameData?.game?.status, gameData?.game?.roundEndTime]);

  if (!gameData) {
    navigate({ to: "/" });
    return null;
  }

  const { game, players, currentPlayer } = gameData;
  const terrorists = players.filter(p => p.team === "terrorist");
  const counterTerrorists = players.filter(p => p.team === "counter_terrorist");
  const isHost = currentPlayer?.isHost;

  const handleMarkDead = async () => {
    try {
      await markPlayerDead({});
    } catch (error) {
      console.error("Failed to mark as dead:", error);
    }
  };

  const handleStartRound = async () => {
    try {
      await startRound({});
    } catch (error) {
      console.error("Failed to start round:", error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateGameSettings({
        roundTimeMinutes: roundTime,
        bombTimeSeconds: bombTime,
      });
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  const handleLeaveGame = async () => {
    try {
      await leaveGame({});
      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to leave game:", error);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Counter-Strike Game</h1>
        <div className="not-prose flex gap-2">
          {isHost && game.status === "lobby" && (
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button 
            className="btn btn-ghost btn-sm text-error"
            onClick={handleLeaveGame}
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {/* Game Status */}
      <div className="not-prose mb-6">
        <div className="alert">
          <div className="flex items-center gap-2">
            {game.status === "lobby" ? (
              <>
                <Users className="w-5 h-5" />
                <span>Waiting in lobby...</span>
              </>
            ) : game.status === "active" ? (
              <>
                <Timer className="w-5 h-5" />
                <span>Round in progress</span>
                {timeLeft !== null && (
                  <span className="font-mono text-lg font-bold">
                    {formatTime(timeLeft)}
                  </span>
                )}
              </>
            ) : (
              <>
                <Clock className="w-5 h-5" />
                <span>Round finished</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && isHost && (
        <div className="not-prose mb-6">
          <div className="card bg-base-200">
            <div className="card-body">
              <h3 className="card-title">Game Settings</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Round Time (minutes)</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={roundTime}
                    onChange={(e) => setRoundTime(Number(e.target.value))}
                    className="range range-primary"
                  />
                  <div className="text-center text-sm mt-1">{roundTime} minutes</div>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Bomb Timer (seconds)</span>
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="300"
                    step="10"
                    value={bombTime}
                    onChange={(e) => setBombTime(Number(e.target.value))}
                    className="range range-warning"
                  />
                  <div className="text-center text-sm mt-1">{bombTime} seconds</div>
                </div>
              </div>
              <div className="card-actions justify-end mt-4">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleUpdateSettings}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams Display */}
      <div className="not-prose grid md:grid-cols-2 gap-6 mb-6">
        {/* Terrorists */}
        <div className="card bg-error text-error-content">
          <div className="card-body">
            <h3 className="card-title justify-center">
              <Target className="w-5 h-5" />
              Terrorists ({terrorists.filter(p => p.isAlive).length}/{terrorists.length})
            </h3>
            <div className="space-y-2">
              {terrorists.map((player) => (
                <div key={player._id} className="flex items-center justify-between">
                  <span className={player.isAlive ? "" : "line-through opacity-50"}>
                    {player.user?.name}
                    {player.isHost && " (Host)"}
                    {player.userId === currentPlayer?.userId && " (You)"}
                  </span>
                  {!player.isAlive && <Skull className="w-4 h-4" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Counter-Terrorists */}
        <div className="card bg-info text-info-content">
          <div className="card-body">
            <h3 className="card-title justify-center">
              <Users className="w-5 h-5" />
              Counter-Terrorists ({counterTerrorists.filter(p => p.isAlive).length}/{counterTerrorists.length})
            </h3>
            <div className="space-y-2">
              {counterTerrorists.map((player) => (
                <div key={player._id} className="flex items-center justify-between">
                  <span className={player.isAlive ? "" : "line-through opacity-50"}>
                    {player.user?.name}
                    {player.isHost && " (Host)"}
                    {player.userId === currentPlayer?.userId && " (You)"}
                  </span>
                  {!player.isAlive && <Skull className="w-4 h-4" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="not-prose flex justify-center gap-4">
        {isHost && game.status === "lobby" && (
          <button 
            className="btn btn-success btn-lg"
            onClick={handleStartRound}
            disabled={players.length < 2}
          >
            <Play className="w-5 h-5" />
            Start Round
          </button>
        )}

        {game.status === "active" && currentPlayer?.isAlive && (
          <button 
            className="btn btn-warning btn-lg"
            onClick={handleMarkDead}
          >
            <Skull className="w-5 h-5" />
            I'm Dead
          </button>
        )}
      </div>

      {/* Game Info */}
      <div className="mt-8 p-4 bg-base-200 rounded-lg text-center">
        <p className="text-sm">
          Round: {game.roundTimeMinutes} min | Bomb: {game.bombTimeSeconds}s
          {isHost && game.status === "lobby" && " | You are the host"}
        </p>
      </div>
    </div>
  );
}