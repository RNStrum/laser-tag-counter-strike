import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { 
  Clock, 
  Skull, 
  Settings, 
  Play, 
  Users, 
  Target,
  LogOut,
  Timer,
  Trophy,
  RotateCcw,
  Bomb,
  Shield,
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { notifications } from "../services/notifications";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { NotificationDebug } from "../components/NotificationDebug";

// Get session ID from localStorage
const getSessionId = () => {
  return localStorage.getItem('cs-session-id') || crypto.randomUUID();
};

export const Route = createFileRoute("/game")({
  component: GamePage,
});

function GamePage() {
  const [sessionId] = useState(getSessionId());
  const navigate = useNavigate();
  
  // Use Convex's useQuery for real-time updates
  const gameData = useQuery(api.games.getCurrentGame, { sessionId });

  // Redirect to home if not in a game
  useEffect(() => {
    if (gameData === null) {
      navigate({ to: "/" });
    }
  }, [gameData, navigate]);

  // Show loading while data is being fetched
  if (gameData === undefined) {
    return (
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p>Loading game...</p>
      </div>
    );
  }

  if (gameData === null) {
    return null; // Will redirect
  }

  return <GameInterface gameData={gameData} sessionId={sessionId} />;
}

function GameInterface({ gameData, sessionId }: { gameData: any, sessionId: string }) {
  const navigate = useNavigate();
  const markPlayerDead = useMutation(api.games.markPlayerDead);
  const startRound = useMutation(api.games.startRound);
  const updateGameSettings = useMutation(api.games.updateGameSettings);
  const leaveGame = useMutation(api.games.leaveGame);
  const checkTimeExpiration = useMutation(api.games.checkTimeExpiration);
  const plantBomb = useMutation(api.games.plantBomb);
  const defuseBomb = useMutation(api.games.defuseBomb);
  const kickPlayer = useMutation(api.games.kickPlayer);

  const [showSettings, setShowSettings] = useState(false);
  const [roundTime, setRoundTime] = useState(5);
  const [bombTime, setBombTime] = useState(120);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [bombTimeLeft, setBombTimeLeft] = useState<number | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [hasRequestedNotifications, setHasRequestedNotifications] = useState(false);
  const previousStatus = useRef(gameData.status);
  const previousBombStatus = useRef(gameData.bombStatus);

  const { players, currentPlayer } = gameData;
  const terrorists = players.filter((p: { team: string; isAlive: boolean }) => p.team === "terrorist");
  const counterTerrorists = players.filter((p: { team: string; isAlive: boolean }) => p.team === "counter_terrorist");
  const isHost = currentPlayer?.isHost;

  // Initialize service worker and request notification permissions
  useEffect(() => {
    if (!hasRequestedNotifications) {
      // Initialize service worker for background notifications
      void notifications.initializeServiceWorker().then(() => {
        return notifications.requestPermission();
      }).then(() => {
        setHasRequestedNotifications(true);
      }).catch(error => {
        console.error('Failed to initialize notifications:', error);
        setHasRequestedNotifications(true);
      });
    }
  }, [hasRequestedNotifications]);

  // Detect round status changes and show notifications
  useEffect(() => {
    if (previousStatus.current !== gameData.status) {
      if (previousStatus.current === "lobby" && gameData.status === "active") {
        // Round started
        void notifications.showRoundStartNotification();
        notifications.playSound('start');
        notifications.vibrate([100, 50, 100]);
      } else if (previousStatus.current === "active" && gameData.status === "finished") {
        // Round ended
        if (gameData.winner) {
          const teamColors = gameData.winner === 'terrorist' ? 
            { bg: 'bg-error', text: 'text-error-content' } :
            gameData.winner === 'counter_terrorist' ? 
            { bg: 'bg-info', text: 'text-info-content' } :
            { bg: 'bg-neutral', text: 'text-neutral-content' };

          void notifications.showRoundEndNotification(gameData.winner, gameData.winReason || '', teamColors);
          
          setShowWinModal(true);
        }
      }
      previousStatus.current = gameData.status;
    }
  }, [gameData.status, gameData.winner, gameData.winReason, currentPlayer?.team]);

  // Detect bomb status changes and show notifications
  useEffect(() => {
    if (previousBombStatus.current !== gameData.bombStatus) {
      if (previousBombStatus.current !== "planted" && gameData.bombStatus === "planted") {
        // Bomb was planted
        void notifications.showBombPlantedNotification();
        notifications.playSound('start');
        notifications.vibrate([200, 100, 200, 100, 200]);
      } else if (previousBombStatus.current === "planted" && gameData.bombStatus === "defused") {
        // Bomb was defused
        void notifications.showBombDefusedNotification();
        notifications.playSound('win');
        notifications.vibrate([100, 50, 100, 50, 100]);
      }
      previousBombStatus.current = gameData.bombStatus;
    }
  }, [gameData.bombStatus]);

  useEffect(() => {
    if (gameData) {
      setRoundTime(gameData.roundTimeMinutes);
      setBombTime(gameData.bombTimeSeconds);
    }
  }, [gameData]);

  // Timer countdown with time expiration check
  useEffect(() => {
    if (gameData?.status === "active" && gameData.roundEndTime) {
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, gameData.roundEndTime! - now);
        setTimeLeft(remaining);
        
        // Check for time expiration
        if (remaining === 0) {
          checkTimeExpiration({ sessionId });
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [gameData?.status, gameData?.roundEndTime, sessionId, checkTimeExpiration]);

  // Bomb timer countdown
  useEffect(() => {
    if (gameData?.status === "active" && gameData.bombStatus === "planted" && gameData.bombExplodeTime) {
      const updateBombTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, gameData.bombExplodeTime! - now);
        setBombTimeLeft(remaining);
        
        // Check for bomb explosion
        if (remaining === 0) {
          checkTimeExpiration({ sessionId });
        }
      };

      updateBombTimer();
      const interval = setInterval(updateBombTimer, 100); // More frequent updates for bomb timer
      return () => clearInterval(interval);
    } else {
      setBombTimeLeft(null);
    }
  }, [gameData?.status, gameData?.bombStatus, gameData?.bombExplodeTime, sessionId, checkTimeExpiration]);

  const handleMarkDead = async () => {
    try {
      await markPlayerDead({ sessionId });
    } catch (error) {
      console.error("Failed to mark as dead:", error);
    }
  };

  const handleStartRound = async () => {
    try {
      await startRound({ sessionId });
      setShowWinModal(false); // Hide any previous win modal
    } catch (error) {
      console.error("Failed to start round:", error);
    }
  };

  const handleNewRound = () => {
    setShowWinModal(false);
    if (isHost) {
      handleStartRound();
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateGameSettings({
        roundTimeMinutes: roundTime,
        bombTimeSeconds: bombTime,
        sessionId,
      });
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  const handleLeaveGame = async () => {
    try {
      await leaveGame({ sessionId });
      // Clear session for fresh start
      localStorage.removeItem('cs-session-id');
      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to leave game:", error);
    }
  };

  const handlePlantBomb = async () => {
    try {
      await plantBomb({ sessionId });
    } catch (error) {
      console.error("Failed to plant bomb:", error);
    }
  };

  const handleDefuseBomb = async () => {
    try {
      await defuseBomb({ sessionId });
    } catch (error) {
      console.error("Failed to defuse bomb:", error);
    }
  };

  // Host can kick players by ID
  const handleKickPlayer = async (playerIdToKick: Id<"players">) => {
    try {
      await kickPlayer({ sessionId, playerIdToKick });
    } catch (error) {
      console.error("Failed to kick player:", error);
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
          {isHost && gameData.status === "lobby" && (
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
        <div className={`alert ${
          gameData.status === "finished" && gameData.winner === "terrorist" ? "alert-error" :
          gameData.status === "finished" && gameData.winner === "counter_terrorist" ? "alert-info" :
          gameData.status === "finished" ? "alert-warning" : ""
        }`}>
          <div className="flex items-center gap-2">
            {gameData.status === "lobby" ? (
              <>
                <Users className="w-5 h-5" />
                <span>Waiting in lobby...</span>
              </>
            ) : gameData.status === "active" ? (
              <>
                <Timer className="w-5 h-5" />
                <span>Round in progress</span>
                {timeLeft !== null && (
                  <span className="font-mono text-lg font-bold">
                    {formatTime(timeLeft)}
                  </span>
                )}
                {gameData.bombStatus === "planted" && bombTimeLeft !== null && (
                  <>
                    <Bomb className="w-5 h-5 text-warning" />
                    <span className="font-mono text-lg font-bold text-warning">
                      💣 {formatTime(bombTimeLeft)}
                    </span>
                  </>
                )}
              </>
            ) : gameData.status === "finished" ? (
              <>
                <Trophy className="w-5 h-5" />
                <span>
                  {gameData.winner === 'draw' ? 'Round ended in a draw' :
                   gameData.winner === 'terrorist' ? 'Terrorists won the round' :
                   gameData.winner === 'counter_terrorist' ? 'Counter-Terrorists won the round' :
                   'Round finished'}
                </span>
                {gameData.winReason && (
                  <span className="text-sm opacity-75">• {gameData.winReason}</span>
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
              Terrorists ({terrorists.filter((p: { isAlive: boolean }) => p.isAlive).length}/{terrorists.length})
            </h3>
            <div className="space-y-2">
              {terrorists.map((player: { _id: string; name: string; isAlive: boolean; isHost: boolean }) => (
                <div key={player._id} className="flex items-center justify-between">
                  <span className={player.isAlive ? "" : "line-through opacity-50"}>
                    {player.name}
                    {player.isHost && " (Host)"}
                    {player._id === currentPlayer?._id && " (You)"}
                  </span>
                  <div className="flex items-center gap-1">
                    {!player.isAlive && <Skull className="w-4 h-4" />}
                    {isHost && player._id !== currentPlayer?._id && !player.isHost && (
                      <button 
                        className="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
                        onClick={() => handleKickPlayer(player._id as Id<"players">)}
                        title="Kick player"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
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
              Counter-Terrorists ({counterTerrorists.filter((p: { isAlive: boolean }) => p.isAlive).length}/{counterTerrorists.length})
            </h3>
            <div className="space-y-2">
              {counterTerrorists.map((player: { _id: string; name: string; isAlive: boolean; isHost: boolean }) => (
                <div key={player._id} className="flex items-center justify-between">
                  <span className={player.isAlive ? "" : "line-through opacity-50"}>
                    {player.name}
                    {player.isHost && " (Host)"}
                    {player._id === currentPlayer?._id && " (You)"}
                  </span>
                  <div className="flex items-center gap-1">
                    {!player.isAlive && <Skull className="w-4 h-4" />}
                    {isHost && player._id !== currentPlayer?._id && !player.isHost && (
                      <button 
                        className="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
                        onClick={() => handleKickPlayer(player._id as Id<"players">)}
                        title="Kick player"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>



      {/* Action Buttons */}
      <div className="not-prose flex justify-center gap-4">
        {isHost && (gameData.status === "lobby" || gameData.status === "finished") && (
          <button 
            className="btn btn-success btn-lg"
            onClick={handleStartRound}
            disabled={gameData.status === "lobby" && players.length < 2}
          >
            <Play className="w-5 h-5" />
            {gameData.status === "finished" ? "Start New Round" : "Start Round"}
          </button>
        )}

        {gameData.status === "active" && currentPlayer?.isAlive && (
          <button 
            className="btn btn-warning btn-lg"
            onClick={handleMarkDead}
          >
            <Skull className="w-5 h-5" />
            I'm Dead
          </button>
        )}

        {gameData.status === "active" && currentPlayer?.isAlive && currentPlayer?.team === "terrorist" && (gameData.bombStatus === "not_planted" || gameData.bombStatus === undefined) && (
          <button 
            className="btn btn-error btn-lg"
            onClick={handlePlantBomb}
          >
            <Bomb className="w-5 h-5" />
            Plant Bomb
          </button>
        )}

        {gameData.status === "active" && currentPlayer?.isAlive && currentPlayer?.team === "counter_terrorist" && gameData.bombStatus === "planted" && (
          <button 
            className="btn btn-info btn-lg"
            onClick={handleDefuseBomb}
          >
            <Shield className="w-5 h-5" />
            Defuse Bomb
          </button>
        )}

        {gameData.status === "finished" && !isHost && (
          <div className="text-center text-sm opacity-75">
            Waiting for host to start new round...
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="mt-8 p-4 bg-base-200 rounded-lg text-center">
        <p className="text-sm">
          Round: {gameData.roundTimeMinutes} min | Bomb: {gameData.bombTimeSeconds}s
          {isHost && gameData.status === "lobby" && " | You are the host"}
        </p>
      </div>

      {/* Winner Modal */}
      {showWinModal && gameData.status === "finished" && gameData.winner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="not-prose max-w-md w-full mx-4">
            <div className={`card ${
              gameData.winner === 'terrorist' ? 'bg-error text-error-content' :
              gameData.winner === 'counter_terrorist' ? 'bg-info text-info-content' :
              'bg-neutral text-neutral-content'
            }`}>
              <div className="card-body text-center">
                <div className="flex justify-center mb-4">
                  <Trophy className="w-16 h-16" />
                </div>
                
                <h2 className="card-title justify-center text-3xl mb-2">
                  {gameData.winner === 'draw' ? '🤝 Draw!' :
                   gameData.winner === 'terrorist' ? '🔥 Terrorists Win!' :
                   '🛡️ Counter-Terrorists Win!'}
                </h2>
                
                <p className="text-lg mb-4">{gameData.winReason}</p>
                
                {gameData.roundDuration && (
                  <p className="text-sm opacity-75 mb-6">
                    Round Duration: {Math.floor(gameData.roundDuration / 60000)}:{
                      String(Math.floor((gameData.roundDuration % 60000) / 1000)).padStart(2, '0')
                    }
                  </p>
                )}

                <div className="card-actions justify-center">
                  {isHost ? (
                    <button 
                      className="btn btn-primary btn-lg"
                      onClick={handleNewRound}
                    >
                      <RotateCcw className="w-5 h-5" />
                      Start New Round
                    </button>
                  ) : (
                    <p className="text-sm opacity-75">
                      Waiting for host to start new round...
                    </p>
                  )}
                  
                  <button 
                    className="btn btn-ghost"
                    onClick={() => setShowWinModal(false)}
                  >
                    Continue Viewing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      {/* Notification Debug Tool */}
      <NotificationDebug />
    </div>
  );
}