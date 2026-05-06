const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC_DIR = path.join(__dirname);
app.use(express.static(PUBLIC_DIR));

const MAX_WRONG_ATTEMPTS = 6;
const TURN_TIMEOUT_MS = 30_000;
const DICTIONARY_WORDS = ["REDES", "SERVIDOR", "COMPUTACION", "INTERFAZ", "SISTEMA", "INGENIERIA", "PROTOCOLO"];

let gameState = {
  secretWord: "",
  attemptedLetters: [],
  attemptedWords: [],
  wrongAttempts: 0,
  gameMode: "",
  activePlayer: 1,
  isRoundActive: false,
  status: null
};

let turnTimer = null;
let pvpSecretPromptsIssued = false;
// For PvP symmetric mode we keep per-player boards under gameState.pvp
gameState.pvp = {
  submissions: { 1: null, 2: null },
  secretWord1: '', // target for player1 (word submitted by player2)
  secretWord2: '', // target for player2 (word submitted by player1)
  attemptedLetters: { 1: [], 2: [] },
  attemptedWords: { 1: [], 2: [] },
  wrongAttempts: { 1: 0, 2: 0 }
};
let pvpSecretSetterSlot = 1;

// Track two PvP players in order of connection
const playerSlots = [null, null]; // [player1, player2]
const playerIdToSlot = {}; // socket.id -> slot number (1 or 2)

function assignPlayerSlot(socketId, name) {
  // Find first available slot (1 or 2)
  if (!playerSlots[0]) {
    playerSlots[0] = { id: socketId, name, socketId };
    playerIdToSlot[socketId] = 1;
    return 1;
  } else if (!playerSlots[1]) {
    playerSlots[1] = { id: socketId, name, socketId };
    playerIdToSlot[socketId] = 2;
    return 2;
  }
  return 0; // spectator
}

function playersSummary() {
  return {
    1: playerSlots[0] ? { name: playerSlots[0].name } : null,
    2: playerSlots[1] ? { name: playerSlots[1].name } : null,
  };
}

function clearPlayerSlot(socketId) {
  const slot = playerIdToSlot[socketId];
  if (slot === 1) {
    playerSlots[0] = null;
  } else if (slot === 2) {
    playerSlots[1] = null;
  }
  delete playerIdToSlot[socketId];
}

function pickRandomWord() {
  return DICTIONARY_WORDS[Math.floor(Math.random() * DICTIONARY_WORDS.length)];
}

function normalizeWord(value) {
  return String(value || "").trim().toUpperCase();
}

function extractGuessValue(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return payload.guess;
  }

  return '';
}

function getPvPGuesserSlot() {
  return pvpSecretSetterSlot === 1 ? 2 : 1;
}

function resetPvpSymmetricState() {
  gameState.secretWord = '';
  gameState.isRoundActive = false;
  gameState.pvp.submissions = {1: null, 2: null};
  gameState.pvp.secretWord1 = '';
  gameState.pvp.secretWord2 = '';
  gameState.pvp.attemptedLetters = {1: [], 2: []};
  gameState.pvp.attemptedWords = {1: [], 2: []};
  gameState.pvp.wrongAttempts = {1: 0, 2: 0};
  pvpSecretPromptsIssued = false;
}

function maybePromptPvpSecretInputs() {
  if (gameState.gameMode !== 'pvp') {
    return;
  }

  if (!playerSlots[0] || !playerSlots[1]) {
    io.emit('waiting', { text: 'Esperando al jugador ausente' });
    return;
  }

  if (pvpSecretPromptsIssued) {
    return;
  }

  // Clear any previous "waiting" message now that both players are present
  io.emit('waiting', { text: '' });

  pvpSecretPromptsIssued = true;
  io.to(playerSlots[0].socketId).emit('promptSetSecret', { slot: 1 });
  io.to(playerSlots[1].socketId).emit('promptSetSecret', { slot: 2 });
}

function clearTurnTimer() {
  if (turnTimer) {
    clearTimeout(turnTimer);
    turnTimer = null;
  }
}

function getVisibleWord() {
  if (!gameState.secretWord) return [];
  return gameState.secretWord.split('').map((character) => (
    gameState.attemptedLetters.includes(character) ? character : null
  ));
}

function getVisibleWordForPlayer(slot) {
  const w = slot === 1 ? gameState.pvp.secretWord1 : gameState.pvp.secretWord2;
  if (!w) return [];
  const attempts = gameState.pvp.attemptedLetters[slot] || [];
  return w.split('').map((c) => (attempts.includes(c) ? c : null));
}

function buildPublicState() {
  // Default public state for non-pvp-symmetric modes
  const publicState = {
    wordLength: gameState.secretWord.length,
    revealedWord: getVisibleWord(),
    usedLetters: [...gameState.attemptedLetters],
    wrongAttempts: gameState.wrongAttempts,
    activePlayer: gameState.activePlayer,
  };

  if (gameState.status) {
    publicState.status = gameState.status;
    publicState.secretWord = gameState.secretWord;
  }

  return publicState;
}

function broadcastState() {
  // For pvp symmetric, we need to send per-player tailored states
  if (gameState.gameMode === 'pvp' && gameState.pvp.secretWord1 && gameState.pvp.secretWord2) {
    // send to player 1
    if (playerSlots[0] && playerSlots[0].socketId) {
      io.to(playerSlots[0].socketId).emit('state', buildPublicStateFor(1));
    }
    // send to player 2
    if (playerSlots[1] && playerSlots[1].socketId) {
      io.to(playerSlots[1].socketId).emit('state', buildPublicStateFor(2));
    }
    return;
  }

  io.emit('state', buildPublicState());
}

function buildPublicStateFor(slot) {
  // slot: 1 or 2
  const opponent = slot === 1 ? 2 : 1;

  const secret = slot === 1 ? gameState.pvp.secretWord1 : gameState.pvp.secretWord2;
  const revealed = getVisibleWordForPlayer(slot);
  const used = [...(gameState.pvp.attemptedLetters[slot] || [])];
  const wrong = gameState.pvp.wrongAttempts[slot] || 0;
  const opponentWrong = gameState.pvp.wrongAttempts[opponent] || 0;
  const opponentRevealedCount = (gameState.pvp['secretWord' + opponent] || '').split('').filter((c, i) => {
    return (gameState.pvp.attemptedLetters[opponent] || []).includes((gameState.pvp['secretWord' + opponent] || '')[i]);
  }).length;

  const publicState = {
    wordLength: secret.length,
    revealedWord: revealed,
    usedLetters: used,
    wrongAttempts: wrong,
    activePlayer: gameState.activePlayer,
    opponentProgress: {
      wrongAttempts: opponentWrong,
      revealedCount: opponentRevealedCount,
      wordLength: (gameState.pvp['secretWord' + opponent] || '').length
    }
  };

  if (!gameState.isRoundActive && gameState.status) {
    // game finished -> include both secrets and result relative to this slot
    const winner = gameState.status === 'winSlot1' ? 1 : (gameState.status === 'winSlot2' ? 2 : null);
    publicState.status = (winner === slot) ? 'win' : 'loss';
    publicState.secretWord = slot === 1 ? gameState.pvp.secretWord1 : gameState.pvp.secretWord2;
    publicState.opponentSecretWord = slot === 1 ? gameState.pvp.secretWord2 : gameState.pvp.secretWord1;
  }

  return publicState;
}

function scheduleTurnTimeout() {
  clearTurnTimer();

  if (!gameState.isRoundActive || !gameState.secretWord) {
    return;
  }

  turnTimer = setTimeout(() => {
    if (!gameState.isRoundActive) {
      return;
    }

    if (gameState.gameMode === 'coop') {
      gameState.activePlayer = gameState.activePlayer === 1 ? 2 : 1;
      io.emit('chat', { sender: 'Sistema', text: `Tiempo agotado. Turno para Jugador ${gameState.activePlayer}.` });
      broadcastState();
      scheduleTurnTimeout();
      return;
    }

    gameState.wrongAttempts += 1;

    if (gameState.wrongAttempts >= MAX_WRONG_ATTEMPTS) {
      gameState.status = 'loss';
      gameState.isRoundActive = false;
      clearTurnTimer();
      io.emit('chat', { sender: 'Sistema', text: 'Tiempo agotado. Se aplicó penalización final.' });
      broadcastState();
      return;
    }

    io.emit('chat', { sender: 'Sistema', text: 'Tiempo agotado. Se aplicó una penalización.' });
    broadcastState();
    scheduleTurnTimeout();
  }, TURN_TIMEOUT_MS);
}

function finishRound(status, message) {
  if (!gameState.isRoundActive) {
    return;
  }

  gameState.status = status;
  gameState.isRoundActive = false;
  clearTurnTimer();

  if (message) {
    io.emit('chat', { sender: 'Sistema', text: message });
  }

  if (gameState.gameMode === 'pvp') {
    pvpSecretSetterSlot = pvpSecretSetterSlot === 1 ? 2 : 1;
  }

  broadcastState();
}

function syncVictoryState() {
  if (!gameState.secretWord) return;

  const solved = gameState.secretWord.split('').every((character) => gameState.attemptedLetters.includes(character));
  if (solved) {
    finishRound('win', `Ganaste. La palabra era ${gameState.secretWord}`);
  }
}

function syncLossState() {
  if (gameState.wrongAttempts >= MAX_WRONG_ATTEMPTS) {
    finishRound('loss', `Perdiste. La palabra era ${gameState.secretWord}`);
  }
}

io.on('connection', (socket) => {
  socket.on('join', (payload) => {
    // payload: { name }
    const name = (payload && payload.name) ? String(payload.name).trim().slice(0,32) : null;
    
    // Only assign if name is valid and not empty
    if (!name || name.length === 0) {
      console.log(`[JOIN] Socket ${socket.id.slice(0,6)}... rechazado: sin nombre válido`);
      socket.emit('joinError', { message: 'El nombre no puede estar vacío' });
      return;
    }

    // Assign player number (1, 2, or 0 for spectator)
    const assigned = assignPlayerSlot(socket.id, name);

    console.log(`[JOIN] Socket ${socket.id.slice(0,6)}... asignado como Jugador ${assigned} con nombre "${name}"`);
    console.log(`[SLOTS] Slot 1: ${playerSlots[0] ? playerSlots[0].name : 'vacío'}, Slot 2: ${playerSlots[1] ? playerSlots[1].name : 'vacío'}`);

    socket.emit('assignPlayerNumber', { number: assigned });
    socket.emit('state', buildPublicState());
    io.emit('players', playersSummary());

    // In symmetric PVP we only prompt once, when both players are present.
    if (gameState.gameMode === 'pvp') {
      maybePromptPvpSecretInputs();
    }
  });

  socket.on('start', (mode) => {
    gameState.gameMode = mode;
    gameState.attemptedLetters = [];
    gameState.attemptedWords = [];
    gameState.wrongAttempts = 0;
    gameState.status = null;
    clearTurnTimer();
    if (mode === 'pve' || mode === 'coop') {
      gameState.secretWord = pickRandomWord();
      gameState.isRoundActive = true;
      gameState.activePlayer = 1;
      io.emit('chat', { sender: 'Sistema', text: 'Juego iniciado. Palabra generada por el servidor.' });
      scheduleTurnTimeout();
    } else if (mode === 'pvp') {
      // Ignore repeated start events while the symmetric PvP setup is already in progress.
      if (!gameState.isRoundActive && !gameState.status && pvpSecretPromptsIssued) {
        maybePromptPvpSecretInputs();
        broadcastState();
        return;
      }

      // PvP symmetric: reset pvp structures and request both submissions
      resetPvpSymmetricState();
      gameState.activePlayer = 1;
      io.emit('chat', { sender: 'Sistema', text: 'Modo PVP simétrico: esperando envíos de palabra de ambos jugadores...' });
      maybePromptPvpSecretInputs();
    }
    broadcastState();
  });

  socket.on('setSecretWord', (word) => {
    if (gameState.gameMode !== 'pvp') return;
    const slot = playerIdToSlot[socket.id];
    if (!slot || (slot !== 1 && slot !== 2)) return;

    const normalizedWord = normalizeWord(word);
    if (!normalizedWord || !/^[A-Z]+$/.test(normalizedWord)) {
      io.to(socket.id).emit('invalidWord', { message: 'La palabra contiene caracteres inválidos.' });
      return;
    }

    // store submission
    gameState.pvp.submissions[slot] = normalizedWord;
    io.emit('chat', { sender: 'Sistema', text: `Jugador ${slot} ha enviado su palabra.` });

    // If both submitted, validate lengths and start round
    const s1 = gameState.pvp.submissions[1];
    const s2 = gameState.pvp.submissions[2];
    if (s1 && s2) {
      if (s1.length !== s2.length) {
        // length mismatch: ask to resubmit
        io.to(playerSlots[0].socketId).emit('invalidWord', { message: 'Las palabras deben tener la misma longitud. Por favor, vuelve a enviar.' });
        io.to(playerSlots[1].socketId).emit('invalidWord', { message: 'Las palabras deben tener la misma longitud. Por favor, vuelve a enviar.' });
        gameState.pvp.submissions = {1: null, 2: null};
        return;
      }

      // both valid -> assign cross-targets: player1 guesses s2, player2 guesses s1
      gameState.pvp.secretWord1 = s2;
      gameState.pvp.secretWord2 = s1;
      gameState.pvp.attemptedLetters = {1: [], 2: []};
      gameState.pvp.attemptedWords = {1: [], 2: []};
      gameState.pvp.wrongAttempts = {1: 0, 2: 0};
      gameState.isRoundActive = true;
      gameState.status = null;
      gameState.activePlayer = 1;
      scheduleTurnTimeout();
      broadcastState();
      io.emit('chat', { sender: 'Sistema', text: 'Ambas palabras aceptadas. Empieza la carrera PvP.' });
    } else {
      // wait for other player
      broadcastState();
    }
  });

  socket.on('guess', (payload) => {
    const actorSlot = playerIdToSlot[socket.id] || 0;
    if (!gameState.isRoundActive) return;

    // PvP symmetric mode handling
    if (gameState.gameMode === 'pvp' && gameState.pvp.secretWord1 && gameState.pvp.secretWord2) {
      if (!actorSlot || actorSlot !== gameState.activePlayer) return;

      const guess = normalizeWord(extractGuessValue(payload));
      if (!/^[A-Z]+$/.test(guess)) return;

      clearTurnTimer();

      const me = actorSlot;
      const opp = me === 1 ? 2 : 1;
      const target = me === 1 ? gameState.pvp.secretWord1 : gameState.pvp.secretWord2;
      const attempts = gameState.pvp.attemptedLetters[me];

      if (guess.length === 1) {
        if (!attempts.includes(guess)) {
          attempts.push(guess);
          if (!target.includes(guess)) {
            gameState.pvp.wrongAttempts[me]++;
          }
        }
      } else {
        // full word guess
        if (!gameState.pvp.attemptedWords[me].includes(guess)) {
          gameState.pvp.attemptedWords[me].push(guess);
          if (guess === target) {
            gameState.pvp.attemptedLetters[me] = Array.from(new Set(target.split('')));
          } else {
            gameState.pvp.wrongAttempts[me]++;
          }
        }
      }

      // Check victory for me
      const allRevealed = (target.split('')).every((c) => gameState.pvp.attemptedLetters[me].includes(c));
      if (allRevealed) {
        gameState.isRoundActive = false;
        gameState.status = me === 1 ? 'winSlot1' : 'winSlot2';
        clearTurnTimer();
        broadcastState();
        return;
      }

      // Check loss for me
      if (gameState.pvp.wrongAttempts[me] >= MAX_WRONG_ATTEMPTS) {
        gameState.isRoundActive = false;
        gameState.status = opp === 1 ? 'winSlot1' : 'winSlot2';
        clearTurnTimer();
        broadcastState();
        return;
      }

      // continue game: alternate turns
      gameState.activePlayer = opp;
      broadcastState();
      scheduleTurnTimeout();
      return;
    }

    // Fallback: existing single-word handling (pve/coop)
    const guess = normalizeWord(extractGuessValue(payload));
    if (!/^[A-Z]+$/.test(guess)) return;

    clearTurnTimer();

    if (guess.length === 1) {
      if (!gameState.attemptedLetters.includes(guess)) {
        gameState.attemptedLetters.push(guess);
        if (!gameState.secretWord.includes(guess)) {
          gameState.wrongAttempts++;
        }
      }
    } else {
      if (!gameState.attemptedWords.includes(guess)) {
        gameState.attemptedWords.push(guess);
        if (guess === gameState.secretWord) {
          gameState.attemptedLetters = Array.from(new Set(gameState.secretWord.split('')));
          gameState.isRoundActive = false;
        } else {
          gameState.wrongAttempts++;
        }
      }
    }

    syncVictoryState();
    syncLossState();

    if (gameState.isRoundActive && gameState.gameMode === 'coop') {
      gameState.activePlayer = gameState.activePlayer === 1 ? 2 : 1;
    }

    if (gameState.isRoundActive) {
      broadcastState();
      scheduleTurnTimeout();
      return;
    }

    broadcastState();
  });

  socket.on('chat', (msg) => {
    if (!msg || !msg.text) return;
    // Format message with player role
    const sender = msg.roleLabel ? `${msg.name} (${msg.roleLabel})` : msg.sender || 'Anon';
    io.emit('chat', { sender, text: msg.text });
  });

  socket.on('requestPromptSetSecret', () => {
    // ask player 1 to set the secret (only when pvp)
    if (gameState.gameMode === 'pvp' && playerSlots[pvpSecretSetterSlot - 1] && playerSlots[pvpSecretSetterSlot - 1].socketId) {
      io.to(playerSlots[pvpSecretSetterSlot - 1].socketId).emit('promptSetSecret', { slot: pvpSecretSetterSlot });
    }
  });

  socket.on('disconnect', () => {
    // free player slot if present
    clearPlayerSlot(socket.id);
    io.emit('players', playersSummary());
    // if in pvp mode and someone left, set waiting
    if (gameState.gameMode === 'pvp') {
      clearTurnTimer();
      gameState.isRoundActive = false;
      gameState.secretWord = '';
      gameState.status = null;
      io.emit('chat', { sender: 'Sistema', text: 'Un jugador se ha desconectado. Esperando reconexión.' });
      io.emit('waiting', { text: 'Esperando al jugador ausente' });
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
