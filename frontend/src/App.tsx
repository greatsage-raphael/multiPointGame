// frontend/src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import Confetti from 'react-confetti';
import './App.css';
import UsernameInput from './components/UsernameInput';
import PlayerCard from './components/PlayerCard';
import GameInfo from './components/GameInfo';
import type { Player, FullGameState } from './types';

const SOCKET_SERVER_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  
  const [roundWinner, setRoundWinner] = useState<{ id: string; username: string } | null>(null);
  const [gameWinners, setGameWinners] = useState<{ id: string; username: string }[] | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const confettiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown Timer state
  const [countdown, setCountdown] = useState<number | undefined>(undefined);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);



  // --- Helper to start the countdown ---
  const startCountdown = (durationMs: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    console.log(`[FE App] Starting countdown for ${durationMs}ms`);
    if (durationMs <= 0) {
        setCountdown(0);
        return;
    }
    setCountdown(Math.ceil(durationMs / 1000)); 

    let remainingTime = durationMs;
    countdownIntervalRef.current = setInterval(() => {
      remainingTime -= 1000;
      if (remainingTime <= 0) {
        setCountdown(0);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        console.log('[FE App] Countdown finished locally.');
      } else {
        setCountdown(Math.ceil(remainingTime / 1000));
      }
    }, 1000);
  };

  // --- Helper to stop the countdown ---
  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      console.log('[FE App] Countdown stopped.');
    }
    setCountdown(undefined);
  };

  // --- Handle Leave Game ---
  const handleLeaveGame = useCallback(() => {
    if (socket && socket.connected) {
      console.log('[FE App] User clicked "Leave Game". Disconnecting socket.');
      socket.disconnect(); 
      setHasJoined(false);
      setCurrentRound(0);
      setTotalRounds(0);
      setIsSpinning(false);
      setRoundWinner(null);
      setGameWinners(null);
      setIsGameOver(false);
      stopCountdown();
      setShowConfetti(false);
      setStatusMessage('You have left the game. Enter username to join again.');
    }
  }, [socket]);

  // --- Handle Play Again ---
  const handlePlayAgain = useCallback(() => {
    if (socket && socket.connected && hasJoined) { // Ensure user is joined to request play again
      console.log('[FE App] User clicked "Play Again". Emitting requestPlayAgain.');
      socket.emit('requestPlayAgain'); 
      setStatusMessage('🚀 Requesting to play again...');
    }
  }, [socket, hasJoined]);


  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 

    console.log('[FE App] useEffect: Attempting to connect to WebSocket server at:', SOCKET_SERVER_URL);
    const newSocket = io(SOCKET_SERVER_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setClientId(newSocket.id!);
      setStatusMessage('✅ Connected to server. Enter username to join.');
      console.log('[FE App] ✅ Successfully connected to server. Socket ID:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.error(`[FE App] ❌ Connection Error: ${err.message}`, err);
      setStatusMessage(`Connection Error: ${err.message}. Is backend running on ${SOCKET_SERVER_URL}? Retrying...`);
    });

    newSocket.on('disconnect', (reason) => {
      setStatusMessage(`🔌 Disconnected from server: ${reason}. Re-enter username if you wish to join.`);
      console.warn('[FE App] 🔌 Disconnected from server. Reason:', reason);
      stopCountdown();
       
      if (reason !== 'io client disconnect') { 
        setHasJoined(false); 
        setCurrentRound(0);
        setTotalRounds(0);
        setIsSpinning(false);
        setRoundWinner(null);
        setGameWinners(null);
        setIsGameOver(false);
        setShowConfetti(false);
      }
    });

    const logReceived = (event: string, data: any) => {
        console.log(`[FE App] 📩 Received '${event}':`, JSON.stringify(data, null, 2));
    };

    newSocket.on('player_update', (data: { players: Player[] }) => {
      logReceived('player_update', data);
      setPlayers(data.players);
      if (hasJoined && !data.players.some(p => p.id === newSocket.id)) {
          console.warn("[FE App] Current client no longer in player list. Marking as not joined.");
          setHasJoined(false);
            // Hide if removed from game
      } else if (!hasJoined && data.players.some(p => p.id === newSocket.id)) {
        setHasJoined(true);
        console.log('[FE App] Confirmed join via player_update.');
      }
    });

    newSocket.on('game_start', (data: { totalRounds: number; players: Player[] }) => {
      logReceived('game_start', data);
      setTotalRounds(data.totalRounds);
      setPlayers(data.players); // Update players list, scores should be reset by backend
      setCurrentRound(0); 
      setIsGameOver(false);       
      setGameWinners(null);     
      setRoundWinner(null);       
      setShowConfetti(false);
        
      stopCountdown();
      setStatusMessage('🎉 Game is starting!');
    });

    newSocket.on('new_round', (data: {
        currentRound: number;
        totalRounds: number;
        roundSpinningDurationMs: number;
    }) => {
      logReceived('new_round', data);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      setIsSpinning(true);
      setRoundWinner(null);
      setShowConfetti(false);
        // Make sure it's hidden during rounds
      startCountdown(data.roundSpinningDurationMs);
      setStatusMessage(`🌟 Round ${data.currentRound} of ${data.totalRounds} begins! Spinning...`);
    });

    newSocket.on('round_result', (data: { winnerId: string | null; winnerUsername: string | null; players: Player[] }) => {
      logReceived('round_result', data);
      setIsSpinning(false);
      stopCountdown();
      setPlayers(data.players);
      if (data.winnerId && data.winnerUsername) {
        setRoundWinner({ id: data.winnerId, username: data.winnerUsername });
        setStatusMessage(`🏆 Round ${currentRound} Winner: ${data.winnerUsername}!`);
        if (data.winnerId === newSocket.id) {
          console.log('[FE App] 🎉 You won this round! Showing confetti.');
          setShowConfetti(true);
          if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
          confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 7000);
        }
      } else {
        setRoundWinner(null);
        if (data.winnerUsername && data.winnerUsername.toLowerCase().includes('cancel')) {
            setStatusMessage(`🚫 ${data.winnerUsername}`);
        } else {
            setStatusMessage(`🏁 Round ${currentRound} ended. No winner this time.`);
        }
      }
    });

    newSocket.on('game_over', (data: { players: Player[]; winners: { id: string; username: string }[] }) => {
      logReceived('game_over', data);
      setPlayers(data.players);
      setIsSpinning(false);
      setIsGameOver(true);
      setGameWinners(data.winners);
      stopCountdown();
      const winnerNames = data.winners.map(w => w.username).join(', ');
      setStatusMessage(winnerNames ? `🎉 Game Over! Winner(s): ${winnerNames}` : '🎉 Game Over! No winners.');
      if (data.winners.some(w => w.id === newSocket.id)) {
        console.log('[FE App] 🥳 You are an overall game winner! Showing confetti.');
        setShowConfetti(true);
        if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 10000);
      }
    });

    newSocket.on('game_state_sync', (data: FullGameState) => {
        logReceived('game_state_sync', data);
        setPlayers(data.players);
        setCurrentRound(data.currentRound);
        setTotalRounds(data.totalRounds);
        setIsSpinning(data.isSpinning);
        setIsGameOver(false); 
        setGameWinners(null);
          // Hide on sync, game_over will show it
        
        if (data.gameStarted && !hasJoined && data.players.some(p => p.id === newSocket.id)) {
            setHasJoined(true);
            console.log('[FE App] Joined via game_state_sync.');
        }
        
        if (data.isSpinning && data.remainingSpinTimeMs !== undefined && data.remainingSpinTimeMs > 0) {
            startCountdown(data.remainingSpinTimeMs);
            setStatusMessage(`🔄 Joined mid-round! Round ${data.currentRound} of ${data.totalRounds}. Spinning...`);
        } else if (data.isSpinning && data.roundSpinningDurationMs) {
            startCountdown(data.roundSpinningDurationMs);
            setStatusMessage(`🔄 Joined mid-round! Round ${data.currentRound} of ${data.totalRounds}. Spinning... (timer from full)`);
        } else if (data.gameStarted) {
            stopCountdown();
            setStatusMessage(`🔄 Joined game in progress. Round ${data.currentRound} of ${data.totalRounds}.`);
        }
        if (!data.isSpinning) {
            stopCountdown();
        }
    });
    
    newSocket.on('game_paused', (data: { message: string }) => {
        logReceived('game_paused', data);
        setIsSpinning(false);
        stopCountdown();
        //   // Don't hide if game was paused after game_over
        setStatusMessage(data.message || "⏳ Game paused. Waiting for players...");
    });

    newSocket.on('status_update', (data: { message: string }) => {
        logReceived('status_update', data);
        setStatusMessage(data.message);
    });

    newSocket.on('joinError', (message: string) => {
        logReceived('joinError', message);
        console.error('[FE App] ❌ Join Error from server:', message);
        alert(`Failed to join game: ${message}`);
        setHasJoined(false);
    });

    newSocket.on('error_message', (message: string) => {
        logReceived('error_message', message);
        alert(`Server Message: ${message}`);
    });

    return () => {
      console.log('[FE App] useEffect cleanup: Disconnecting socket if connected.');
      if (newSocket && newSocket.connected) {
          // newSocket.disconnect(); // Let user actions or unmount handle disconnect more explicitly
      }
      window.removeEventListener('resize', handleResize);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      stopCountdown();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleJoinGame = useCallback((username: string) => {
    if (socket && socket.connected && !hasJoined) {
      console.log(`[FE App] 📤 Emitting 'joinGame' with username: ${username}`);
      socket.emit('joinGame', username);
      setStatusMessage('⏳ Attempting to join... Waiting for server confirmation.');
    } else if (socket && !socket.connected) {
        console.warn('[FE App] Cannot join: Socket not connected.');
        setStatusMessage('❌ Cannot join. Not connected to server.');
    } else if (hasJoined) {
        console.warn('[FE App] Cannot join: Already joined.');
    } else {
        console.error('[FE App] Cannot join: Socket is null.');
        setStatusMessage('❌ Cannot join. Socket not initialized.');
    }
  }, [socket, hasJoined]);

  return (
    <div className="App">
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.15}
          initialVelocityX={7}
          initialVelocityY={20}
          className="confetti-canvas"
        />
      )}
      <header className="App-header">
        <h1>Multi-Round Points Game</h1>
      </header>
      <main>
        {!hasJoined && clientId && (
          <UsernameInput onJoin={handleJoinGame} disabled={!socket?.connected} />
        )}

        {(hasJoined || players.length > 0) && (
          <GameInfo
            currentRound={currentRound}
            totalRounds={totalRounds}
            statusMessage={statusMessage}
            roundWinner={roundWinner} 
            gameWinners={gameWinners} 
            isGameOver={isGameOver}
            countdownTime={countdown}
          />
        )}

        {players.length > 0 && (
          <div className="players-container">
            <h2>Players ({players.length})</h2>
            <div className="player-list">
              {players.map((player) => {
                const isPlayerRoundWinner = !isGameOver && roundWinner?.id === player.id;
                const isPlayerGameWinner = isGameOver && gameWinners?.some(gw => gw.id === player.id);
                
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isCurrentUser={player.id === clientId}
                    isSpinningActive={isSpinning && !isGameOver}
                    isRoundWinner={isPlayerRoundWinner}
                    isGameWinner={isPlayerGameWinner}
                    onLeaveGame={player.id === clientId && hasJoined ? handleLeaveGame : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {isGameOver && hasJoined && (
          <button onClick={handlePlayAgain} className="play-again-button">
            Play Again?
          </button>
        )}

         {!clientId && statusMessage.toLowerCase().includes("initializing") && <p>Connecting to server...</p>}
         {clientId && !hasJoined && players.length === 0 && (statusMessage.includes("Connected") || statusMessage.includes("left the game")) && <p>Enter username and click "Join Game" to start.</p>}
         {hasJoined && players.length === 0 && !isGameOver && <p>Waiting for other players or game data...</p>}
      </main>
    </div>
  );
}

export default App;