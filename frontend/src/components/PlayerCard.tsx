// frontend/src/components/PlayerCard.tsx
import React from 'react';
import type { Player } from '../types';
import Spinner from './Spinner';

interface PlayerCardProps {
  player: Player;
  isCurrentUser: boolean;
  isSpinningActive: boolean;
  isRoundWinner?: boolean;
  isGameWinner?: boolean;
  onLeaveGame?: () => void; // New prop for callback
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isCurrentUser,
  isSpinningActive,
  isRoundWinner,
  isGameWinner,
  onLeaveGame, // Destructure new prop
}) => {
  const avatarUrl = `https://robohash.org/${player.id}.png?set=set1&bgset=bg1&size=100x100`;

  return (
    <div className={`player-card ${isCurrentUser ? 'current-user' : ''} ${isGameWinner ? 'game-winner-card' : ''}`}>
      <img src={avatarUrl} alt={`${player.username}'s avatar`} className="player-avatar" />
      <div className="player-info">
        <h3>
          {player.username} {isCurrentUser && "(You)"}
          {isGameWinner && <span className="trophy-icon game-winner-trophy">🏆</span>}
          {isRoundWinner && !isGameWinner && <span className="trophy-icon">🏆</span>}
        </h3>
        <p>Score: {player.score}</p>
        {isGameWinner && <p className="overall-winner-text">Overall Winner!</p>}
      </div>
      {isSpinningActive && <Spinner />}

      {/* Leave Game Button for current user */}
      {isCurrentUser && onLeaveGame && (
        <button onClick={onLeaveGame} className="leave-game-button">
          Leave Game
        </button>
      )}
    </div>
  );
};

export default PlayerCard;