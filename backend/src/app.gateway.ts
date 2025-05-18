import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface Player {
  id: string;
  username: string;
  score: number;
}

interface GameState {
  players: Map<string, Player>;
  currentRound: number;
  totalRounds: number;
  gameStarted: boolean;
  roundInProgress: boolean;
  roundSpinningDurationMs: number;
  minPlayersToStart: number;
  roundTimer: NodeJS.Timeout | null;
  nextRoundDelayMs: number;
  currentRoundStartTimeMs: number | null; // Tracks when the current spin started
}

@WebSocketGateway({
  cors: {
    origin: '*', 
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  private gameState: GameState = {
    players: new Map<string, Player>(),
    currentRound: 0,
    totalRounds: 3,
    gameStarted: false,
    roundInProgress: false,
    roundSpinningDurationMs: 7000, // 7 seconds spinning (increased for better timer visibility)
    minPlayersToStart: 4, 
    roundTimer: null,
    nextRoundDelayMs: 3000,
    currentRoundStartTimeMs: null, 
  };

  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Gateway Initialized and Ready!');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`➡️ Client connected: ${client.id} from ${client.handshake.address}`);
  }

  handleDisconnect(client: Socket) {
    const player = this.gameState.players.get(client.id);

    if (player) {
      this.logger.log(`⬅️ Player ${player.username} (${client.id}) disconnected/left.`);
      this.gameState.players.delete(client.id);
      this.broadcastPlayerUpdate(); // Inform all clients about the updated player list

      // If the game was started and in progress
      if (this.gameState.gameStarted) {
        // Check if player count drops below minimum
        if (this.gameState.players.size < this.gameState.minPlayersToStart) {
          this.logger.warn(`⚠️ Player count (${this.gameState.players.size}) dropped below minimum (${this.gameState.minPlayersToStart}) after ${player.username} left.`);
          
          // If a round was actively spinning
          if (this.gameState.roundInProgress) {
            this.logger.log(`Round ${this.gameState.currentRound} was in progress. Clearing round timer as not enough players.`);
            if (this.gameState.roundTimer) clearTimeout(this.gameState.roundTimer);
            this.gameState.roundInProgress = false;
            this.gameState.currentRoundStartTimeMs = null;
            // Option 1: End the current round without a winner (or just pause)
            // We won't call determineRoundWinner. The round effectively stops.
            this.server.emit('round_result', { // Notify clients round ended due to player drop
                winnerId: null,
                winnerUsername: 'Round cancelled - player left',
                players: Array.from(this.gameState.players.values()),
            });
             this.server.emit('game_paused', { message: `Game paused: Not enough players (${this.gameState.players.size}/${this.gameState.minPlayersToStart}). Waiting for more...` });
            // Option 2: End the game entirely if desired (more drastic)
            // this.endGame(); 
            // return;
          } else {
            // Round was not spinning, but game was started. Just notify about pause.
            this.server.emit('game_paused', { message: `Game paused: Not enough players (${this.gameState.players.size}/${this.gameState.minPlayersToStart}). Waiting for more...` });
          }
          // The game will now wait for more players before starting a new round (due to checks in startNewRound)
        } else if (this.gameState.roundInProgress && this.gameState.players.size === 0) {
            // Edge case: Last player leaves mid-spin
            this.logger.warn(`⚠️ Last player ${player.username} left mid-spin. Round cancelled.`);
            if (this.gameState.roundTimer) clearTimeout(this.gameState.roundTimer);
            this.gameState.roundInProgress = false;
            this.gameState.currentRoundStartTimeMs = null;
            this.server.emit('round_result', {
                winnerId: null,
                winnerUsername: 'Round cancelled - last player left',
                players: [],
            });
            // Potentially end game here if no players are left.
            // this.endGame();
            this.server.emit('game_paused', { message: `Game ended: All players left.` });
            this.resetGameStateFull(); // Or reset it fully
        }
        // If enough players remain, the game continues. The next round_result or new_round will proceed.
      }
    } else {
      this.logger.log(`⬅️ Client disconnected: ${client.id} (was not an active player or already removed).`);
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() username: string,
  ): void {
    this.logger.log(`📩 Received 'joinGame' from ${client.id} with username: ${username}`);
    if (this.gameState.players.has(client.id)) {
      this.logger.warn(`⚠️ Player ${client.id} (${username}) attempted to join again.`);
      client.emit('joinError', 'You have already joined the game.');
      return;
    }

    const newPlayer: Player = {
      id: client.id,
      username: username || `Player_${client.id.substring(0, 5)}`,
      score: 0,
    };
    this.gameState.players.set(client.id, newPlayer);
    this.logger.log(`👍 Player ${newPlayer.username} (${client.id}) successfully joined.`);

    this.broadcastPlayerUpdate();

    if (this.gameState.gameStarted) {
        this.logger.log(`🚀 Game already started. Sending 'game_state_sync' to ${newPlayer.username}`);
        const now = Date.now();
        let remainingSpinTimeMs = 0;
        if (this.gameState.roundInProgress && this.gameState.currentRoundStartTimeMs) {
            const elapsedSpinTimeMs = now - this.gameState.currentRoundStartTimeMs;
            remainingSpinTimeMs = Math.max(0, this.gameState.roundSpinningDurationMs - elapsedSpinTimeMs);
        }

        client.emit('game_state_sync', {
            players: Array.from(this.gameState.players.values()),
            currentRound: this.gameState.currentRound,
            totalRounds: this.gameState.totalRounds,
            isSpinning: this.gameState.roundInProgress,
            gameStarted: true,
            roundSpinningDurationMs: this.gameState.roundSpinningDurationMs,
            remainingSpinTimeMs: this.gameState.roundInProgress ? remainingSpinTimeMs : 0,
        });
    } else {
       this.server.emit('status_update', { message: `Waiting for players... ${this.gameState.players.size}/${this.gameState.minPlayersToStart}` });
    }


    if (
      !this.gameState.gameStarted &&
      this.gameState.players.size >= this.gameState.minPlayersToStart
    ) {
      this.logger.log('🎉 Minimum players reached! Attempting to start game.');
      this.startGame();
    } else if (!this.gameState.gameStarted) {
        this.logger.log(`⏳ Waiting for more players. Current: ${this.gameState.players.size}/${this.gameState.minPlayersToStart}`);
    }
  }



  private broadcastPlayerUpdate(): void {
    const playersList = Array.from(this.gameState.players.values());
    this.logger.log(`📢 Broadcasting 'player_update': ${playersList.length} players`, JSON.stringify(playersList.map(p => ({u:p.username, s:p.score}))));
    this.server.emit('player_update', {
      players: playersList,
    });
  }

  private startGame(): void {
    if (this.gameState.gameStarted && this.gameState.currentRound > 0) { // Prevent restarting if already truly in progress
        this.logger.warn('⚠️ Attempted to start game, but game is already in progress.');
        return;
    }
    if (this.gameState.players.size < this.gameState.minPlayersToStart) {
        this.logger.warn(`⚠️ Attempted to start game, but not enough players: ${this.gameState.players.size}/${this.gameState.minPlayersToStart}`);
        this.server.emit('status_update', { message: `Waiting for ${this.gameState.minPlayersToStart - this.gameState.players.size} more player(s) to start.` });
        return;
    }

    this.logger.log('🚀🚀🚀 GAME STARTING (or RESTARTING)! 🚀🚀🚀');
    this.gameState.gameStarted = true;
    this.gameState.currentRound = 0;
    this.gameState.players.forEach(p => p.score = 0); // Reset scores
    
    const playersList = Array.from(this.gameState.players.values());
    this.logger.log('📢 Broadcasting, "game_start:"', { totalRounds: this.gameState.totalRounds, playersCount: playersList.length });
    this.server.emit('game_start', { // This signals clients to reset their game over state
      totalRounds: this.gameState.totalRounds,
      players: playersList,
    });
    this.broadcastPlayerUpdate(); // Send updated scores (all zero)
    this.startNewRound();
  }


  private startNewRound(): void {
    if (!this.gameState.gameStarted) { /* ... */ return; }
    if (this.gameState.players.size < this.gameState.minPlayersToStart) {
        this.logger.warn(`⚠️ Not enough players to start new round (${this.gameState.players.size}/${this.gameState.minPlayersToStart}). Game paused.`);
        this.server.emit('game_paused', { message: `Game paused. Waiting for ${this.gameState.minPlayersToStart - this.gameState.players.size} more player(s) to continue...` });
        return;
    }
    if (this.gameState.currentRound >= this.gameState.totalRounds) { /* ... */ return; }

    this.gameState.currentRound++;
    this.gameState.roundInProgress = true;
    this.gameState.currentRoundStartTimeMs = Date.now(); 

    this.logger.log(`🌟 Starting Round ${this.gameState.currentRound} of ${this.gameState.totalRounds}. Spin duration: ${this.gameState.roundSpinningDurationMs}ms`);

    this.server.emit('new_round', {
      currentRound: this.gameState.currentRound,
      totalRounds: this.gameState.totalRounds,
      roundSpinningDurationMs: this.gameState.roundSpinningDurationMs,
    });

    if (this.gameState.roundTimer) clearTimeout(this.gameState.roundTimer);
    this.gameState.roundTimer = setTimeout(() => {
      this.logger.log('⏰ Round timer expired. Determining winner.');
      this.determineRoundWinner();
    }, this.gameState.roundSpinningDurationMs);
  }

  private determineRoundWinner(): void {
    if (!this.gameState.roundInProgress) { /* ... */ return; }
    
    this.gameState.roundInProgress = false;
    this.gameState.currentRoundStartTimeMs = null; 
    let winner: Player | null = null;

    const activePlayers = Array.from(this.gameState.players.values());
    if (activePlayers.length > 0) {
      const randomIndex = Math.floor(Math.random() * activePlayers.length);
      winner = activePlayers[randomIndex];
      winner.score++;
      this.logger.log(`🏆 Round ${this.gameState.currentRound} winner: ${winner.username} (Score: ${winner.score})`);
    } else {
      this.logger.warn(`🤷 No active players to select a winner for round ${this.gameState.currentRound}`);
    }
    
    const playersList = Array.from(this.gameState.players.values());
    this.server.emit('round_result', {
      winnerId: winner ? winner.id : null,
      winnerUsername: winner ? winner.username : 'No one',
      players: playersList,
    });

    if (this.gameState.currentRound >= this.gameState.totalRounds) {
      this.logger.log('🏁 Final round completed. Ending game.');
      this.endGame();
    } else {
      this.logger.log(`⏱️ Scheduling next round after ${this.gameState.nextRoundDelayMs}ms delay.`);
      setTimeout(() => {
        this.startNewRound();
      }, this.gameState.nextRoundDelayMs);
    }
  }

  private endGame(): void {
    this.logger.log('🎉🎉🎉 GAME OVER! 🎉🎉🎉');
    // ... (determine gameWinners logic as before) ...
    const finalPlayers = Array.from(this.gameState.players.values());
    let highScore = 0;
    finalPlayers.forEach(p => { if (p.score > highScore) highScore = p.score; });
    const gameWinners = finalPlayers.filter(p => p.score === highScore && highScore > 0);

    this.logger.log('📢 Broadcasting "game_over:"', { /* ... */ });
    this.server.emit('game_over', {
      players: finalPlayers,
      winners: gameWinners.map(w => ({ id: w.id, username: w.username })),
    });

    // DO NOT call resetGameState() immediately here if we want "Play Again"
    // Instead, the game is now in a "game over" state.
    // `resetGameState()` will be effectively part of `startGame` logic now for score/round reset.
    // We just need to set gameStarted to false to allow startGame to run again.
    this.gameState.gameStarted = false; // Mark game as over but players/state preserved for "Play Again"
    this.gameState.roundInProgress = false;
    if (this.gameState.roundTimer) clearTimeout(this.gameState.roundTimer);
    this.gameState.currentRoundStartTimeMs = null;
    this.logger.log('Game ended. Ready for "Play Again" or new players joining.');
  }
  
  private resetGameStateFull(): void { // Renamed for clarity
    this.logger.log('🔄 Performing FULL reset of game state.');
    if (this.gameState.roundTimer) clearTimeout(this.gameState.roundTimer);
    this.gameState.players.clear(); // Clears all players
    this.gameState.currentRound = 0;
    this.gameState.gameStarted = false;
    this.gameState.roundInProgress = false;
    this.gameState.roundTimer = null;
    this.gameState.currentRoundStartTimeMs = null;
    this.broadcastPlayerUpdate();
    this.server.emit('status_update', { message: "Game has been fully reset." });
  }

  @SubscribeMessage('requestPlayAgain')
  handleRequestPlayAgain(@ConnectedSocket() client: Socket): void {
    const player = this.gameState.players.get(client.id);
    if (!player) {
      this.logger.warn(`⚠️ Client ${client.id} sent 'requestPlayAgain' but is not a known player.`);
      client.emit('error_message', 'You are not in the game to request play again.');
      return;
    }

    // If game is already started and not over, ignore.
    if (this.gameState.gameStarted && this.gameState.currentRound > 0) {
        this.logger.warn(`⚠️ ${player.username} requested Play Again, but game is still in progress.`);
        client.emit('status_update', { message: 'Game is currently in progress.' });
        return;
    }
    
    this.logger.log(`🙋 ${player.username} requested to Play Again.`);
    // Simplistic: if enough players are still connected, restart the game.
    // A more complex system might collect "ready" votes.
    if (this.gameState.players.size >= this.gameState.minPlayersToStart) {
      this.logger.log('Sufficient players connected. Attempting to restart game for Play Again.');
      // The startGame method now handles resetting scores and rounds for existing players.
      this.startGame();
    } else {
      this.logger.log(`⏳ Play Again requested, but not enough players. Waiting for more. Players: ${this.gameState.players.size}/${this.gameState.minPlayersToStart}`);
      this.server.emit('status_update', { message: `Play Again requested! Waiting for ${this.gameState.minPlayersToStart - this.gameState.players.size} more player(s)...` });
    }
  }
}