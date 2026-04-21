const DICTIONARY_WORDS = ["REDES", "SERVIDOR", "COMPUTACION", "INTERFAZ", "SISTEMA", "INGENIERIA", "PROTOCOLO"];
// Estado principal de la partida.
let secretWord = "";
let attemptedLetters = [];
let attemptedWords = [];
let wrongAttempts = 0;
const MAX_WRONG_ATTEMPTS = 6;
let gameMode = "";
let activePlayer = 1;
let isRoundActive = false;

const canvasContext = document.getElementById("hangmanCanvas").getContext("2d");

// Atajos de teclado para enviar sin usar el mouse.
const guessInput = document.getElementById("guessInput");
const chatMessageInput = document.getElementById("chatMessageInput");

guessInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        handleGuessSubmission();
    }
});

chatMessageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        handleChatMessage();
    }
});

function startGameSession(selectedMode) {
    // Define modo, limpia estado y arranca ronda nueva.
    gameMode = selectedMode;
    document.getElementById("modeSelector").style.display = "none";
    document.getElementById("modeDisplay").innerText = gameMode.toUpperCase();
    resetRoundState();

    if (gameMode === "pve" || gameMode === "coop") {
        secretWord = pickRandomWord();
        isRoundActive = true;
        appendChatMessage("Sistema", "Juego iniciado. Palabra generada por CPU.");
        renderGameState();
    } else if (gameMode === "pvp") {
        requestSecretWordFromPlayerOne();
    }
}

function resetRoundState() {
    // Reinicia variables y UI del tablero.
    attemptedLetters = [];
    attemptedWords = [];
    wrongAttempts = 0;
    activePlayer = 1;
    document.getElementById("gameStatus").innerText = "";
    document.getElementById("usedDisplay").innerText = "";
    document.getElementById("submitGuessButton").disabled = false;
    document.getElementById("guessInput").disabled = false;
    canvasContext.clearRect(0, 0, 180, 220);
    drawGallowsFrame();
}

function handleGuessSubmission() {
    // Toma la entrada y decide si es letra o palabra.
    if (!isRoundActive) {
        return;
    }

    const input = document.getElementById("guessInput");
    const playerGuess = input.value.trim().toUpperCase();
    input.value = "";
    input.focus();

    if (!/^[A-Z]+$/.test(playerGuess)) {
        return;
    }

    if (playerGuess.length === 1) {
        applyLetterGuess(playerGuess);
    } else {
        applyWordGuess(playerGuess);
    }

    if (isRoundActive && gameMode === "coop") {
        activePlayer = activePlayer === 1 ? 2 : 1;
    }

    renderGameState();
}

function renderGameState() {
    // Dibuja la palabra oculta y estadísticas actuales.
    let maskedWord = "";
    for (const character of secretWord) {
        maskedWord += attemptedLetters.includes(character) ? character + " " : "_ ";
    }

    document.getElementById("wordDisplay").innerText = maskedWord;
    document.getElementById("errorDisplay").innerText = `${wrongAttempts} / ${MAX_WRONG_ATTEMPTS}`;
    document.getElementById("turnDisplay").innerText = `Jugador ${activePlayer}`;
}

function evaluateWinCondition() {
    // Gana cuando todas las letras de la palabra fueron descubiertas.
    const hasWon = secretWord.split("").every((character) => attemptedLetters.includes(character));
    if (hasWon) {
        finishRound(`Ganaste. La palabra era ${secretWord}`, "green");
    }
}

function evaluateLossCondition() {
    // Pierde cuando alcanza el máximo de errores.
    if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
        finishRound(`Perdiste. La palabra era ${secretWord}`, "red");
    }
}

function finishRound(message, color) {
    // Cierra la ronda y bloquea entrada de nuevos intentos.
    isRoundActive = false;
    const status = document.getElementById("gameStatus");
    status.innerText = message;
    status.style.color = color;
    document.getElementById("submitGuessButton").disabled = true;
    document.getElementById("guessInput").disabled = true;
    appendChatMessage("Sistema", message);
}

function drawGallowsFrame() {
    // Dibuja la estructura base del ahorcado.
    canvasContext.lineWidth = 4;
    canvasContext.strokeStyle = "#333";
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
    // Dibuja una parte del cuerpo según cantidad de errores.
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

function handleChatMessage() {
    // Publica mensajes locales en el panel de chat.
    const input = document.getElementById("chatMessageInput");
    const text = input.value.trim();
    if (!text) {
        return;
    }

    appendChatMessage(`Jugador ${activePlayer}`, text);
    input.value = "";
}

function appendChatMessage(sender, text) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = sender === "Sistema" ? "msg sys" : "msg";
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function applyLetterGuess(letter) {
    // Procesa intentos de una sola letra.
    if (attemptedLetters.includes(letter)) {
        return;
    }

    attemptedLetters.push(letter);
    renderGuessesHistory();

    if (secretWord.includes(letter)) {
        evaluateWinCondition();
    } else {
        wrongAttempts++;
        drawHangmanSegment(wrongAttempts);
        evaluateLossCondition();
    }
}

function applyWordGuess(wordGuess) {
    // Procesa intentos de palabra completa.
    if (attemptedWords.includes(wordGuess)) {
        return;
    }

    attemptedWords.push(wordGuess);
    renderGuessesHistory();

    if (wordGuess === secretWord) {
        attemptedLetters = Array.from(new Set(secretWord.split("")));
        finishRound(`Ganaste. La palabra era ${secretWord}`, "green");
        return;
    }

    wrongAttempts++;
    drawHangmanSegment(wrongAttempts);
    evaluateLossCondition();
}

function renderGuessesHistory() {
    // Muestra letras y palabras ya intentadas.
    const letters = attemptedLetters.length > 0 ? attemptedLetters.join(" - ") : "";
    const words = attemptedWords.length > 0 ? attemptedWords.map((word) => `[${word}]`).join(" ") : "";
    const separator = letters && words ? " | " : "";
    document.getElementById("usedDisplay").innerText = `${letters}${separator}${words}`;
}

function pickRandomWord() {
    // Elige una palabra aleatoria del diccionario local.
    return DICTIONARY_WORDS[Math.floor(Math.random() * DICTIONARY_WORDS.length)];
}

function requestSecretWordFromPlayerOne() {
    // En PVP pide palabra al jugador 1 y oculta el flujo con prompt.
    setTimeout(() => {
        const input = prompt("JUGADOR 1: Escribe la palabra secreta.\n(JUGADOR 2, no mires la pantalla)");
        if (input && /^[a-zA-Z]+$/.test(input)) {
            secretWord = input.trim().toUpperCase();
            activePlayer = 2;
            isRoundActive = true;
            appendChatMessage("Sistema", "El Jugador 1 ha definido la palabra secreta.");
            renderGameState();
        } else {
            alert("Palabra no valida. Reiniciando partida.");
            restartCurrentMatch();
        }
    }, 100);
}

function restartCurrentMatch() {
    // Reinicia la partida respetando el modo activo.
    if (!gameMode) {
        return;
    }

    resetRoundState();

    if (gameMode === "pvp") {
        requestSecretWordFromPlayerOne();
        return;
    }

    secretWord = pickRandomWord();
    isRoundActive = true;
    appendChatMessage("Sistema", "Partida reiniciada.");
    renderGameState();
}

window.startGameSession = startGameSession;
window.handleGuessSubmission = handleGuessSubmission;
window.handleChatMessage = handleChatMessage;
window.restartCurrentMatch = restartCurrentMatch;
