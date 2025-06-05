import { SignInButton } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Target, Users, Clock } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const gameQueryOptions = convexQuery(api.games.getCurrentGame, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    try {
      await queryClient.ensureQueryData(gameQueryOptions);
    } catch {
      // User might not be authenticated or not in a game
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="text-center">
      <div className="not-prose flex justify-center mb-4">
        <Target className="w-16 h-16 text-primary" />
      </div>
      <h1>Counter-Strike Game</h1>
      <p className="mb-8">Real-life tactical gameplay facilitator</p>

      <Unauthenticated>
        <p>Sign in to join or create a game.</p>
        <div className="not-prose mt-4">
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <GameLobby />
      </Authenticated>
    </div>
  );
}

function GameLobby() {
  const navigate = useNavigate();
  const { data: gameData } = useSuspenseQuery(gameQueryOptions);
  const createOrJoinGame = useMutation(api.games.createOrJoinGame);
  const ensureUser = useMutation(api.users.ensureUser);

  const handleJoinTeam = async (team: "terrorist" | "counter_terrorist") => {
    try {
      await ensureUser({});
      await createOrJoinGame({ team });
      navigate({ to: "/game" });
    } catch (error) {
      console.error("Failed to join game:", error);
    }
  };

  if (gameData) {
    navigate({ to: "/game" });
    return null;
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

      <div className="mt-8 p-4 bg-base-200 rounded-lg">
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
  );
}
