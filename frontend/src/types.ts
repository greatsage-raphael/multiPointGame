export interface Player {
  id: string;
  username: string;
  score: number;
}

export interface FullGameState {
    players: Player[];
    currentRound: number;
    totalRounds: number;
    isSpinning: boolean;
    gameStarted: boolean;
    roundSpinningDurationMs?: number; // Duration of the current spin
    remainingSpinTimeMs?: number;    // Remaining time for current spin (for late joiners)
}