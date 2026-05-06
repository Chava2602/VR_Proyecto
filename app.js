const MAX_WRONG_ATTEMPTS = 6;

let currentGameMode = '';
let latestPublicState = {
    wordLength: 0,
    revealedWord: [],
    usedLetters: [],
    wrongAttempts: 0,
    activePlayer: 1,
    status: null,
    secretWord: ''
};

let socket = null;
let networkEnabled = false;
let assignedPlayerNumber = 0;
let playerNames = { 1: '--', 2: '--' };
let isJoined = false;

const canvasElement = document.getElementById('hangmanCanvas');
const canvasContext = canvasElement ? canvasElement.getContext('2d') : null;
const guessInput = document.getElementById('guessInput');
const chatMessageInput = document.getElementById('chatMessageInput');

if (typeof io === 'function') {
    try {
        socket = io();
        networkEnabled = true;
    } catch (error) {
        socket = null;
        networkEnabled = false;
    }
}

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);
    if (element) {
        element.innerText = value;
    }
}

function setDisabled(id, disabled) {
    const element = getElement(id);
    if (element) {
        element.disabled = disabled;
    }
}

function normalizePublicState(publicState) {
    const state = publicState || {};

    return {
        wordLength: Number(state.wordLength) || 0,
        revealedWord: Array.isArray(state.revealedWord) ? state.revealedWord : [],
        usedLetters: Array.isArray(state.usedLetters) ? state.usedLetters : [],
        wrongAttempts: Number(state.wrongAttempts) || 0,
        activePlayer: Number(state.activePlayer) || 1,
        status: state.status || null,
        secretWord: typeof state.secretWord === 'string' ? state.secretWord : '',
        opponentProgress: state.opponentProgress || null,
        opponentSecretWord: typeof state.opponentSecretWord === 'string' ? state.opponentSecretWord : ''
    };
}

function connectToServer() {
    const nameInput = getElement('playerNameInput');
    const name = nameInput ? nameInput.value.trim().slice(0, 32) : '';

    if (!name) {
        alert('Por favor, ingresa un nombre valido antes de conectarte.');
        if (nameInput) {
            nameInput.focus();
        }
        return false;
    }

    if (!networkEnabled || !socket) {
        appendChatMessage('Sistema', 'Servidor no disponible.');
        return false;
    }

    if (isJoined) {
        return true;
    }

    socket.emit('join', { name });
    return true;
}

function resetBoardView() {
    latestPublicState = {
        wordLength: 0,
        revealedWord: [],
        usedLetters: [],
        wrongAttempts: 0,
        activePlayer: 1,
        status: null,
        secretWord: ''
    };

    setText('gameStatus', '');
    setText('usedDisplay', '');
    setText('wordDisplay', '');
    setText('turnDisplay', '');
    setDisabled('submitGuessButton', true);
    setDisabled('guessInput', true);

    if (canvasContext) {
        canvasContext.clearRect(0, 0, 180, 220);
        drawGallowsFrame();
    }
}

function renderUI(publicState) {
    const state = normalizePublicState(publicState);
    latestPublicState = state;

    renderWordDisplay(state.revealedWord);
    renderUsedLetters(state.usedLetters);
    setText('errorDisplay', `${state.wrongAttempts} / ${MAX_WRONG_ATTEMPTS}`);
    renderCanvas(state.wrongAttempts);
    renderTurnDisplay(state);
    renderRoundStatus(state);

    // Render opponent progress if provided (PvP symmetric)
    if (state.opponentProgress) {
        const op = state.opponentProgress;
        setText('opponentErrors', op.wrongAttempts !== undefined ? `${op.wrongAttempts} / ${MAX_WRONG_ATTEMPTS}` : '');
        setText('opponentRevealed', op.revealedCount !== undefined ? `${op.revealedCount} / ${op.wordLength || ''}` : '');
    }

    const controlsEnabled = Boolean(
        state.wordLength > 0 &&
        !state.status &&
        assignedPlayerNumber > 0 &&
        state.activePlayer === assignedPlayerNumber
    );

    setDisabled('guessInput', !controlsEnabled);
    setDisabled('submitGuessButton', !controlsEnabled);
}

function renderWordDisplay(revealedWord) {
    const pieces = Array.isArray(revealedWord) ? revealedWord : [];
    const maskedWord = pieces.map((character) => (character ? `${character} ` : '_ ')).join('').trimEnd();
    setText('wordDisplay', maskedWord);
}

function renderUsedLetters(usedLetters) {
    const letters = Array.isArray(usedLetters) ? usedLetters : [];
    setText('usedDisplay', letters.length > 0 ? letters.join(' - ') : '');
}

function renderTurnDisplay(state) {
    const turnDisplay = getElement('turnDisplay');
    if (!turnDisplay) {
        return;
    }

    if (state.wordLength > 0) {
        const currentPlayerName = playerNames[state.activePlayer] || `Jugador ${state.activePlayer}`;
        turnDisplay.innerText = `Turno: ${currentPlayerName}`;
    } else {
        turnDisplay.innerText = 'Turno: esperando partida';
    }
}

function renderRoundStatus(state) {
    const statusElement = getElement('gameStatus');
    if (!statusElement) {
        return;
    }

    if (state.status === 'win' && state.secretWord) {
        statusElement.innerText = `Ganaste. La palabra era ${state.secretWord}`;
        statusElement.style.color = 'green';
        return;
    }

    if (state.status === 'loss' && state.secretWord) {
        statusElement.innerText = `Perdiste. La palabra era ${state.secretWord}`;
        statusElement.style.color = 'red';
    }
}

function renderCanvas(wrongAttempts) {
    if (!canvasContext) {
        return;
    }

    canvasContext.clearRect(0, 0, 180, 220);
    drawGallowsFrame();

    const attempts = Math.max(0, Math.min(MAX_WRONG_ATTEMPTS, Number(wrongAttempts) || 0));
    for (let segment = 1; segment <= attempts; segment += 1) {
        drawHangmanSegment(segment);
    }
}

function showValidationError(message) {
    const statusElement = getElement('gameStatus');
    if (statusElement) {
        statusElement.innerText = message;
        statusElement.style.color = 'red';
    }
    alert(message);
}

if (networkEnabled && socket) {
    socket.on('connect', () => {
        appendChatMessage('Sistema', 'Conectado al servidor de juego. Pulsa "Conectarse" para registrarte.');
    });

    socket.on('assignPlayerNumber', (payload) => {
        isJoined = true;
        assignedPlayerNumber = payload.number || 0;
        const roleText = assignedPlayerNumber === 1
            ? 'JUGADOR 1 (establece palabra)'
            : assignedPlayerNumber === 2
                ? 'JUGADOR 2 (adivina)'
                : 'ESPECTADOR';

        appendChatMessage('Sistema', `Tu rol: ${roleText}`);

        const statusElement = getElement('playerStatusText');
        if (statusElement) {
            statusElement.innerText = `Tu rol: ${roleText}`;
        }

        const connectButton = getElement('connectButton');
        if (connectButton) {
            connectButton.disabled = true;
        }
    });

    socket.on('joinError', (err) => {
        const message = err && err.message ? err.message : 'Error al unirse.';
        appendChatMessage('Sistema', message);
        alert(message);
    });

    socket.on('players', (payload) => {
        playerNames[1] = payload && payload[1] ? payload[1].name : '--';
        playerNames[2] = payload && payload[2] ? payload[2].name : '--';

        const playerOne = getElement('player1Name');
        const playerTwo = getElement('player2Name');

        if (playerOne) {
            playerOne.innerText = playerNames[1];
        }
        if (playerTwo) {
            playerTwo.innerText = playerNames[2];
        }
    });

    socket.on('state', (publicState) => {
        renderUI(publicState);
    });

    socket.on('invalidWord', (err) => {
        const message = err && err.message ? err.message : 'La palabra fue rechazada por el servidor.';
        showValidationError(message);

        if (currentGameMode === 'pvp') {
            setTimeout(requestSecretWordFromSetter, 0);
        }
    });

    socket.on('chat', (message) => {
        appendChatMessage(message && message.sender ? message.sender : 'Anon', message && message.text ? message.text : '');
    });

    socket.on('waiting', (message) => {
        const statusElement = getElement('gameStatus');
        if (statusElement) {
            statusElement.innerText = message && message.text ? message.text : '';
            statusElement.style.color = 'orange';
        }
    });

    socket.on('promptSetSecret', () => {
        requestSecretWordFromSetter();
    });

    socket.on('connect_error', () => {
        appendChatMessage('Sistema', 'No se pudo comunicar con el servidor.');
        networkEnabled = false;
    });
}

if (guessInput) {
    guessInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleGuessSubmission();
        }
    });
}

if (chatMessageInput) {
    chatMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleChatMessage();
        }
    });
}

function startGameSession(selectedMode) {
    currentGameMode = selectedMode;

    const modeSelector = getElement('modeSelector');
    if (modeSelector) {
        modeSelector.style.display = 'none';
    }

    setText('modeDisplay', String(selectedMode || '').toUpperCase());
    resetBoardView();

    if (!networkEnabled || !socket) {
        appendChatMessage('Sistema', 'Servidor no disponible.');
        return;
    }

    if (!connectToServer()) {
        return;
    }

    socket.emit('start', selectedMode);
}

function handleGuessSubmission() {
    if (!networkEnabled || !socket) {
        return;
    }

    const input = getElement('guessInput');
    if (!input) {
        return;
    }

    const value = input.value.trim().toUpperCase();
    input.value = value;

    if (!value) {
        input.value = '';
        return;
    }

    socket.emit('guess', value);
    input.value = '';
}

function handleChatMessage() {
    const input = getElement('chatMessageInput');
    if (!input) {
        return;
    }

    const text = input.value.trim();
    if (!text || !networkEnabled || !socket) {
        input.value = '';
        return;
    }

    const playerName = playerNames[assignedPlayerNumber] || 'Jugador';
    const roleLabel = assignedPlayerNumber === 1
        ? 'Jugador 1'
        : assignedPlayerNumber === 2
            ? 'Jugador 2'
            : 'Espectador';

    socket.emit('chat', {
        playerNumber: assignedPlayerNumber,
        name: playerName,
        roleLabel,
        text
    });

    input.value = '';
}

function appendChatMessage(sender, text) {
    const box = getElement('chatBox');
    if (!box) {
        return;
    }

    const messageBox = document.createElement('div');
    messageBox.className = sender === 'Sistema' ? 'msg sys' : 'msg';
    messageBox.innerHTML = `<strong>${sender}:</strong> ${text}`;
    box.appendChild(messageBox);
    box.scrollTop = box.scrollHeight;
}

function drawGallowsFrame() {
    if (!canvasContext) {
        return;
    }

    canvasContext.lineWidth = 4;
    canvasContext.strokeStyle = '#333';
    canvasContext.beginPath();
    canvasContext.moveTo(20, 200);
    canvasContext.lineTo(160, 200);
    canvasContext.moveTo(40, 200);
    canvasContext.lineTo(40, 20);
    canvasContext.moveTo(40, 20);
    canvasContext.lineTo(100, 20);
    canvasContext.moveTo(100, 20);
    canvasContext.lineTo(100, 40);
    canvasContext.stroke();
}

function drawHangmanSegment(segment) {
    if (!canvasContext) {
        return;
    }

    canvasContext.lineWidth = 3;
    canvasContext.beginPath();

    switch (segment) {
        case 1:
            canvasContext.arc(100, 60, 20, 0, Math.PI * 2);
            break;
        case 2:
            canvasContext.moveTo(100, 80);
            canvasContext.lineTo(100, 140);
            break;
        case 3:
            canvasContext.moveTo(100, 90);
            canvasContext.lineTo(70, 120);
            break;
        case 4:
            canvasContext.moveTo(100, 90);
            canvasContext.lineTo(130, 120);
            break;
        case 5:
            canvasContext.moveTo(100, 140);
            canvasContext.lineTo(70, 180);
            break;
        case 6:
            canvasContext.moveTo(100, 140);
            canvasContext.lineTo(130, 180);
            break;
        default:
            break;
    }

    canvasContext.stroke();
}

function requestSecretWordFromSetter() {
    if (!networkEnabled || !socket) {
        return;
    }

    setTimeout(() => {
        const roleName = assignedPlayerNumber === 1 ? 'JUGADOR 1' : assignedPlayerNumber === 2 ? 'JUGADOR 2' : 'JUGADOR';
        const input = prompt(`${roleName}: Escribe la palabra secreta.\nEl otro jugador no debe ver la pantalla.`);
        if (input === null) {
            return;
        }

        const word = input.trim().toUpperCase();
        if (!word) {
            showValidationError('La palabra no puede estar vacia.');
            return;
        }

        socket.emit('setSecretWord', word);
    }, 100);
}

function restartCurrentMatch() {
    if (!currentGameMode) {
        return;
    }

    resetBoardView();

    if (!networkEnabled || !socket) {
        appendChatMessage('Sistema', 'Servidor no disponible.');
        return;
    }

    if (!connectToServer()) {
        return;
    }

    socket.emit('start', currentGameMode);
}

window.startGameSession = startGameSession;
window.handleGuessSubmission = handleGuessSubmission;
window.handleChatMessage = handleChatMessage;
window.restartCurrentMatch = restartCurrentMatch;
