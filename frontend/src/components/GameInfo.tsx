import React from 'react';

interface GameInfoProps {
  currentRound: number;
  totalRounds: number;
  statusMessage: string;
  roundWinner?: { id: string; username: string } | null;
  gameWinners?: { id: string; username: string }[] | null;
  isGameOver: boolean;
  countdownTime?: number; // In seconds
}

const GameInfo: React.FC<GameInfoProps> = ({
  currentRound,
  totalRounds,
  statusMessage,
  roundWinner,
  gameWinners,
  isGameOver,
  countdownTime,
}) => {
  return (
    <div className="game-info">
      <h2>Game Status</h2>
      <p className="status-message">{statusMessage}</p>

      {countdownTime !== undefined && countdownTime > 0 && !isGameOver && (
        <div className="countdown-timer">
          Spinning ends in: {countdownTime}s
        </div>
      )}

      {!isGameOver && currentRound > 0 && totalRounds > 0 && (
        <p>Round: {currentRound} / {totalRounds}</p>
      )}
      {roundWinner && !isGameOver && (
        <p className="round-winner-info">Round Winner: {roundWinner.username}!</p>
      )}
      {isGameOver && gameWinners && gameWinners.length > 0 && (
        <div className="game-over-info">
          <h3>Game Over!</h3>
          <p>Winner(s): {gameWinners.map(w => w.username).join(', ')}</p>
        </div>
      )}
       {isGameOver && gameWinners && gameWinners.length === 0 && (
        <div className="game-over-info">
          <h3>Game Over!</h3>
          <p>No winner this time!</p>
        </div>
      )}
    </div>
  );
};

export default GameInfo;