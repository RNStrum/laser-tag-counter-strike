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
- Host controls: start round, adjust round time (1-20 min), bomb timer (40s-5min)
- Player death button and live team status display
- Real-time game state synchronization

**Target Users:** Groups playing real-life tactical games (laser tag, airsoft, etc.)

## Session Progress
- ✅ Gathered detailed app requirements
- 🔄 Documenting requirements and removing template instructions

## Next Steps
- Remove template instructions from CLAUDE.md
- Plan MVP implementation with Convex real-time features
- Design game state schema and user flows
- Implement core functionality

## Important Context
- This is a template repository being initialized into a new application
- Full-stack TypeScript: React + Vite + TanStack Router (frontend), Convex (backend), Clerk (auth)
- Need to remove demo content but keep useful layout structure and auth

## Instructions for Future Sessions
If starting fresh, reread the project:init-app command contents in the original message to understand the initialization workflow.