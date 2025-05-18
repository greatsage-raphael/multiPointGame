# Multi-Round Points Game

**By:** Mwambazi Collins

## Project Overview

This project is a simplified real-time multiplayer game developed as a take-home coding exercise. The application allows multiple users to join a game session consisting of several rounds. In each round, players have a visual "spinning element" displayed while the backend determines a round "winner" who is awarded points. The frontend displays player scores, round information, spinning elements, dynamically generated avatars, a synchronized countdown timer, and the overall game winner after a predetermined number of rounds. The game also features a "Play Again" option, a "Leave Game" button for individual players, and graceful handling of disconnections. When a player wins a round or the game, confetti is displayed on their screen, and a trophy icon appears on their player card.


## Project Structure

The project is organized into two main directories within the root `multi-round-points/` folder:

-   `backend/`: Contains the NestJS (TypeScript) application that serves as the WebSocket server. It manages game state, player connections, round progression, and winner determination.
-   `frontend/`: Contains the React (TypeScript with Vite) application for the client-side user interface. It handles user input, displays game information, visual elements like spinners and timers, and communicates with the backend via WebSockets.

A more detailed breakdown:

multi-round-points/
├── backend/
│ ├── src/
│ │ ├── app.gateway.ts # Core WebSocket logic, game state, and event handling
│ │ ├── app.module.ts # NestJS root module configuration
│ │ └── main.ts # NestJS application entry point and server setup
│ ├── .eslintrc.js
│ ├── .prettierrc
│ ├── nest-cli.json
│ ├── package.json # Backend dependencies and scripts
│ ├── tsconfig.build.json
│ └── tsconfig.json
|
├── frontend/
│ ├── public/ # Static assets 
│ ├── src/
│ │ ├── components/ # Reusable React UI components
│ │ │ ├── GameInfo.tsx # Displays round, status, winners
│ │ │ ├── PlayerCard.tsx # Displays individual player info, avatar, spinner, trophy
│ │ │ ├── Spinner.tsx # Visual spinning element
│ │ │ └── UsernameInput.tsx # Form for user to enter their name
│ │ ├── App.css # Main application styles
│ │ ├── App.tsx # Root React component, manages state and WebSocket client logic
│ │ ├── vite-env.d.ts # Vite environment type definitions
│ │ ├── main.tsx # React application entry point (renders App.tsx)
│ │ └── types.ts # Shared TypeScript type definitions for frontend state
│ ├── index.html # Main HTML file for the React app
│ ├── package.json # Frontend dependencies and scripts
│ ├── tsconfig.json
│ ├── tsconfig.node.json
│ └── vite.config.ts
|
└── README.md # This file


## Core Technologies Used

*   **Backend**:
    *   NestJS (v8+ recommended, based on typical Nest CLI generation)
    *   TypeScript (v4+)
    *   WebSockets (via `@nestjs/websockets` and the underlying `socket.io` library)
    *   Node.js (v16+ recommended)
*   **Frontend**:
    *   React (v18+)
    *   TypeScript (v4+)
    *   Vite (Modern frontend build tool)
    *   WebSockets (via `socket.io-client` library)
    *   CSS (for styling, including Flexbox and Grid for layout)
    *   `react-confetti` (Library for confetti win animations)
    *   Robohash.org API (For dynamically generating unique robot avatars)

## Hardcoded Values & Configuration

The following values are hardcoded in the application and can be adjusted if needed:

**Backend (`backend/src/app.gateway.ts` - within the `gameState` object initialization):**
*   **`totalRounds`**: `3` (The fixed number of rounds per game session)
*   **`roundSpinningDurationMs`**: `5000` (5000 milliseconds, or 5 seconds, for the "spinning" or "thinking" phase of each round)
*   **`minPlayersToStart`**: `4` (The minimum number of connected players required for a game to automatically start.)
*   **`nextRoundDelayMs`**: `3000` (3000 milliseconds, or 3 seconds, delay after a round's result is shown before the next round begins)

**Backend (`backend/src/main.ts`):**
*   **Server Port**: `3001` (The default port the NestJS backend server listens on for HTTP and WebSocket connections)

**Frontend (`frontend/src/App.tsx`):**
*   **`SOCKET_SERVER_URL`**: `'http://localhost:3001'` (The URL the frontend application uses to establish a WebSocket connection with the backend server)

## Setup and Running the Application

### Prerequisites

*   **Node.js**: Version 16 or higher is recommended. You can download it from [nodejs.org](https://nodejs.org/).
*   **npm** (Node Package Manager): Usually comes with Node.js. Version 7 or higher is recommended. (Alternatively, `yarn` or `pnpm` can be used if preferred, but these instructions will use `npm`.)

### 1. Backend Setup & Execution

Follow these steps to get the NestJS backend server running:

```bash
# 1. Clone the repository and navigate to the project root.
# git clone <repository_url>
# cd multi-round-points

# 2. Navigate to the backend directory:
cd backend

# 3. Install all necessary dependencies:
npm install

# 4. Run the backend server in development mode:
# This command typically uses `nodemon` for hot-reloading on file changes.
npm run start:dev
```



### 2. Frontend Setup & Execution

```bash
# 1. Navigate to the frontend directory from the project root:
# If you are currently in the 'backend' directory, use: cd ../frontend
# If you are in the project root, use: cd frontend
cd frontend

# 2. Install all necessary dependencies:
npm install

# 3. Run the frontend development server using Vite:
npm run dev

```


### Screen Recording (Optional):
A short screen recording demonstrating the application features with multiple browser windows can be viewed here: [Link to your GIF/video if you create one]