# Claude Code Session Notes

## Current Session: Application Initialization

**Current Step**: Step 1 - Requirements Gathering (completed)
**Status**: Documenting app requirements

## App Concept: Real-Life Counter-Strike Game Facilitator

**Core Functionality:**
- Single game/lobby support for up to 10 players (5v5 max, uneven teams allowed)
- Team selection: Terrorist vs Counter-Terrorist
- Host-controlled game settings and round management
- Real-time player status tracking (alive/dead)
- Round timer and bomb countdown functionality

**Key Features:**
- Team selection screen on app open
- Host role: first player to join becomes host
- Host controls: start round, adjust round time (1-20 min), bomb timer (40s-5min)
- Player death button and live team status display
- Real-time game state synchronization

**Target Users:** Groups playing real-life tactical games (laser tag, airsoft, etc.)

## MVP Implementation Plan

**Database Schema:**
- `games` table: gameId, hostId, status, settings (roundTime, bombTime), currentRound
- `players` table: playerId, gameId, userId, team, isAlive, isHost

**User Flows:**
1. Join game → Select team (first player becomes host)
2. Host: Configure settings, start round
3. Players: Mark death, view team status
4. Real-time: Live timer, player status updates

**Routes:**
- `/` - Team selection/lobby
- `/game` - Active game view
- `/host` - Host controls (conditional)

## Session Progress
- ✅ Gathered detailed app requirements
- ✅ Documented requirements and removed template instructions
- ✅ Planned MVP implementation
- ✅ Implemented Convex schema and backend functions
- ✅ Built core UI components (team selection, game interface)
- 🔄 Testing implementation

## Commits Made During Session
- init: document Counter-Strike game facilitator app requirements

## Next Steps
- Test real-time functionality with dev servers
- Verify responsive design and user flows
- Fix any bugs or issues found during testing

## Important Context
- This is a template repository being initialized into a new application
- Full-stack TypeScript: React + Vite + TanStack Router (frontend), Convex (backend), Clerk (auth)
- Need to remove demo content but keep useful layout structure and auth

## Instructions for Future Sessions
If starting fresh, reread the project:init-app command contents in the original message to understand the initialization workflow.