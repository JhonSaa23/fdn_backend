// Servicio del juego de 3 en raya con WebSockets
class GameService {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // Almacenar las salas de juego
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🎮 Usuario conectado: ${socket.id}`);

      // Crear o unirse a una sala
      socket.on('joinRoom', (data) => {
        this.handleJoinRoom(socket, data);
      });

      // Movimiento del juego
      socket.on('makeMove', (data) => {
        this.handleMove(socket, data);
      });

      // Mensaje de chat
      socket.on('sendMessage', (data) => {
        this.handleChatMessage(socket, data);
      });

      // Reiniciar juego
      socket.on('restartGame', () => {
        this.handleRestartGame(socket);
      });

      // Desconexión
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  generateRoomId() {
    // Generar ID de 5 dígitos
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  createNewRoom(roomId, playerName) {
    return {
      id: roomId,
      players: [{
        id: null,
        name: playerName,
        symbol: 'X'
      }],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'waiting', // waiting, playing, finished
      winner: null,
      createdAt: new Date(),
      chatMessages: []
    };
  }

  handleJoinRoom(socket, { roomId, playerName }) {
    try {
      let room;
      
      // Si no se proporciona roomId, crear una nueva sala
      if (!roomId) {
        roomId = this.generateRoomId();
        while (this.rooms.has(roomId)) {
          roomId = this.generateRoomId();
        }
        room = this.createNewRoom(roomId, playerName);
        this.rooms.set(roomId, room);
      } else {
        room = this.rooms.get(roomId);
        
        // Si la sala no existe, crear una nueva
        if (!room) {
          room = this.createNewRoom(roomId, playerName);
          this.rooms.set(roomId, room);
        } else if (room.players.length >= 2) {
          // Sala llena
          socket.emit('roomError', { message: 'La sala está llena' });
          return;
        } else if (room.players.find(p => p.name === playerName)) {
          // Nombre ya existe en la sala
          socket.emit('roomError', { message: 'Ya existe un jugador con ese nombre en la sala' });
          return;
        } else {
          // Unirse como segundo jugador
          room.players.push({
            id: socket.id,
            name: playerName,
            symbol: 'O'
          });
          room.status = 'playing';
        }
      }

      // Asignar ID del socket al jugador
      const player = room.players.find(p => p.name === playerName);
      if (player) {
        player.id = socket.id;
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerName = playerName;

      // Notificar a todos en la sala
      this.io.to(roomId).emit('roomUpdate', {
        room: {
          id: room.id,
          players: room.players,
          board: room.board,
          currentPlayer: room.currentPlayer,
          status: room.status,
          winner: room.winner
        }
      });

      // Mensaje de chat automático
      const joinMessage = {
        id: Date.now(),
        playerName: 'Sistema',
        message: `${playerName} se unió a la sala`,
        timestamp: new Date(),
        isSystem: true
      };
      room.chatMessages.push(joinMessage);
      this.io.to(roomId).emit('newMessage', joinMessage);

      console.log(`🎮 ${playerName} se unió a la sala ${roomId}`);
    } catch (error) {
      console.error('Error en joinRoom:', error);
      socket.emit('roomError', { message: 'Error al unirse a la sala' });
    }
  }

  handleMove(socket, { position }) {
    try {
      const roomId = socket.roomId;
      const room = this.rooms.get(roomId);

      if (!room) {
        socket.emit('gameError', { message: 'Sala no encontrada' });
        return;
      }

      if (room.status !== 'playing') {
        socket.emit('gameError', { message: 'El juego no está en curso' });
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        socket.emit('gameError', { message: 'Jugador no encontrado' });
        return;
      }

      if (player.symbol !== room.currentPlayer) {
        socket.emit('gameError', { message: 'No es tu turno' });
        return;
      }

      if (room.board[position] !== null) {
        socket.emit('gameError', { message: 'Posición ya ocupada' });
        return;
      }

      // Realizar el movimiento
      room.board[position] = player.symbol;

      // Verificar ganador
      const winner = this.checkWinner(room.board);
      if (winner) {
        room.status = 'finished';
        room.winner = winner;
        
        // Mensaje de chat automático
        const winMessage = {
          id: Date.now(),
          playerName: 'Sistema',
          message: winner === 'tie' ? '¡Empate!' : `¡${player.name} gana!`,
          timestamp: new Date(),
          isSystem: true
        };
        room.chatMessages.push(winMessage);
        this.io.to(roomId).emit('newMessage', winMessage);
      } else {
        // Cambiar turno
        room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      }

      // Notificar movimiento a todos en la sala
      this.io.to(roomId).emit('gameUpdate', {
        board: room.board,
        currentPlayer: room.currentPlayer,
        status: room.status,
        winner: room.winner
      });

    } catch (error) {
      console.error('Error en makeMove:', error);
      socket.emit('gameError', { message: 'Error al realizar movimiento' });
    }
  }

  handleChatMessage(socket, { message }) {
    try {
      const roomId = socket.roomId;
      const room = this.rooms.get(roomId);

      if (!room) {
        socket.emit('chatError', { message: 'Sala no encontrada' });
        return;
      }

      const chatMessage = {
        id: Date.now(),
        playerName: socket.playerName,
        message: message.trim(),
        timestamp: new Date(),
        isSystem: false
      };

      room.chatMessages.push(chatMessage);

      // Mantener solo los últimos 50 mensajes
      if (room.chatMessages.length > 50) {
        room.chatMessages = room.chatMessages.slice(-50);
      }

      this.io.to(roomId).emit('newMessage', chatMessage);
    } catch (error) {
      console.error('Error en sendMessage:', error);
      socket.emit('chatError', { message: 'Error al enviar mensaje' });
    }
  }

  handleRestartGame(socket) {
    try {
      const roomId = socket.roomId;
      const room = this.rooms.get(roomId);

      if (!room) {
        socket.emit('gameError', { message: 'Sala no encontrada' });
        return;
      }

      // Solo reiniciar si ambos jugadores están presentes
      if (room.players.length !== 2) {
        socket.emit('gameError', { message: 'Se necesitan 2 jugadores para reiniciar' });
        return;
      }

      // Reiniciar el juego
      room.board = Array(9).fill(null);
      room.currentPlayer = 'X';
      room.status = 'playing';
      room.winner = null;

      // Mensaje de chat automático
      const restartMessage = {
        id: Date.now(),
        playerName: 'Sistema',
        message: `${socket.playerName} reinició el juego`,
        timestamp: new Date(),
        isSystem: true
      };
      room.chatMessages.push(restartMessage);

      this.io.to(roomId).emit('gameUpdate', {
        board: room.board,
        currentPlayer: room.currentPlayer,
        status: room.status,
        winner: room.winner
      });

      this.io.to(roomId).emit('newMessage', restartMessage);

    } catch (error) {
      console.error('Error en restartGame:', error);
      socket.emit('gameError', { message: 'Error al reiniciar juego' });
    }
  }

  handleDisconnect(socket) {
    try {
      const roomId = socket.roomId;
      const playerName = socket.playerName;

      if (!roomId || !playerName) return;

      const room = this.rooms.get(roomId);
      if (!room) return;

      // Mensaje de chat automático
      const leaveMessage = {
        id: Date.now(),
        playerName: 'Sistema',
        message: `${playerName} abandonó la sala`,
        timestamp: new Date(),
        isSystem: true
      };
      room.chatMessages.push(leaveMessage);

      // Remover jugador de la sala
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        // Si no quedan jugadores, eliminar la sala después de 5 minutos
        setTimeout(() => {
          if (this.rooms.has(roomId) && this.rooms.get(roomId).players.length === 0) {
            this.rooms.delete(roomId);
            console.log(`🗑️ Sala ${roomId} eliminada por inactividad`);
          }
        }, 5 * 60 * 1000);
      } else {
        // Si queda un jugador, cambiar estado a waiting
        room.status = 'waiting';
        room.board = Array(9).fill(null);
        room.currentPlayer = 'X';
        room.winner = null;

        // Notificar al jugador restante
        this.io.to(roomId).emit('roomUpdate', {
          room: {
            id: room.id,
            players: room.players,
            board: room.board,
            currentPlayer: room.currentPlayer,
            status: room.status,
            winner: room.winner
          }
        });

        this.io.to(roomId).emit('newMessage', leaveMessage);
      }

      console.log(`👋 ${playerName} desconectado de la sala ${roomId}`);
    } catch (error) {
      console.error('Error en disconnect:', error);
    }
  }

  checkWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
      [0, 4, 8], [2, 4, 6] // Diagonales
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }

    // Verificar empate
    if (board.every(cell => cell !== null)) {
      return 'tie';
    }

    return null;
  }
}

module.exports = (io) => {
  new GameService(io);
};
