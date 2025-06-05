import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Target, Users, Clock, User } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "../../convex/_generated/api";

// Generate a session ID for anonymous users
const getSessionId = () => {
  let sessionId = localStorage.getItem('cs-session-id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('cs-session-id', sessionId);
  }
  return sessionId;
};

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [sessionId] = useState(getSessionId());
  const navigate = useNavigate();

  // Use Convex's useQuery for real-time updates
  const gameData = useQuery(api.games.getCurrentGame, { sessionId });

  // If user is already in a game, redirect to game page
  useEffect(() => {
    if (gameData) {
      navigate({ to: "/game" });
    }
  }, [gameData, navigate]);

  if (gameData === undefined) {
    // Loading state
    return (
      <div className="text-center">
        <div className="not-prose flex justify-center mb-4">
          <Target className="w-16 h-16 text-primary" />
        </div>
        <span className="loading loading-spinner loading-lg"></span>
        <p>Loading...</p>
      </div>
    );
  }

  if (gameData) {
    return null; // Will redirect
  }

  return (
    <div className="text-center">
      <div className="not-prose flex justify-center mb-4">
        <Target className="w-16 h-16 text-primary" />
      </div>
      <h1>Counter-Strike Game</h1>
      <p className="mb-8">Real-life tactical gameplay facilitator</p>

      <GameLobby sessionId={sessionId} />
    </div>
  );
}

function GameLobby({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const createOrJoinGame = useMutation(api.games.createOrJoinGame);
  const [playerName, setPlayerName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<"terrorist" | "counter_terrorist" | null>(null);

  const handleJoinTeam = (team: "terrorist" | "counter_terrorist") => {
    setSelectedTeam(team);
    setShowNameInput(true);
  };

  const handleSubmit = async () => {
    if (!playerName.trim() || !selectedTeam) return;

    try {
      await createOrJoinGame({ 
        team: selectedTeam, 
        playerName: playerName.trim(),
        sessionId 
      });
      navigate({ to: "/game" });
    } catch (error) {
      console.error("Failed to join game:", error);
      alert("Failed to join game. Please try again.");
    }
  };

  if (showNameInput) {
    return (
      <div className="max-w-md mx-auto">
        <h2 className="mb-6">Enter Your Name</h2>
        <div className="not-prose space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Player Name</span>
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              className="input input-bordered"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-ghost flex-1"
              onClick={() => setShowNameInput(false)}
            >
              Back
            </button>
            <button 
              className={`btn flex-1 ${selectedTeam === 'terrorist' ? 'btn-error' : 'btn-info'}`}
              onClick={handleSubmit}
              disabled={!playerName.trim()}
            >
              Join {selectedTeam === 'terrorist' ? 'Terrorists' : 'Counter-Terrorists'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="mb-8">Choose Your Team</h2>
      
      <div className="not-prose grid md:grid-cols-2 gap-6">
        <div className="card bg-error text-error-content">
          <div className="card-body text-center">
            <Target className="w-12 h-12 mx-auto mb-4" />
            <h3 className="card-title justify-center text-2xl">Terrorists</h3>
            <p className="mb-6">Plant the bomb and eliminate the enemy team</p>
            <div className="card-actions justify-center">
              <button 
                className="btn btn-error btn-lg" 
                onClick={() => handleJoinTeam("terrorist")}
              >
                Join Terrorists
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-info text-info-content">
          <div className="card-body text-center">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <h3 className="card-title justify-center text-2xl">Counter-Terrorists</h3>
            <p className="mb-6">Defuse the bomb and eliminate the terrorists</p>
            <div className="card-actions justify-center">
              <button 
                className="btn btn-info btn-lg" 
                onClick={() => handleJoinTeam("counter_terrorist")}
              >
                Join Counter-Terrorists
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <Unauthenticated>
          <div className="not-prose">
            <div className="alert alert-info">
              <User className="w-5 h-5" />
              <span>No account needed! Just enter your name and play.</span>
            </div>
          </div>
        </Unauthenticated>

        <Authenticated>
          <div className="not-prose">
            <div className="alert alert-success">
              <User className="w-5 h-5" />
              <span>Signed in - your progress will be saved!</span>
            </div>
          </div>
        </Authenticated>

        <div className="p-4 bg-base-200 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">Game Rules</span>
          </div>
          <ul className="text-sm space-y-1 text-left max-w-md mx-auto">
            <li>• Up to 5v5 players (uneven teams allowed)</li>
            <li>• First player becomes the host</li>
            <li>• Host can configure round and bomb timers</li>
            <li>• Press "I'm Dead" when eliminated</li>
            <li>• Round ends when time runs out or all players eliminated</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
