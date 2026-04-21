# Ahorcado Fase 2 (Local)

Juego de Ahorcado hecho con HTML, CSS y JavaScript puro.
Incluye modo local sin servidor, dibujo del ahorcado en canvas, chat local y soporte para adivinar letras o palabras completas.

## Contexto academico

Este proyecto corresponde a la Entrega 2: Fase 2 - Desarrollo del Videojuego Basico.
El objetivo de esta fase es implementar la logica del videojuego en una version funcional sin conexion en red.

## Caracteristicas

- Interfaz web responsive.
- 3 modos de juego: Player vs CPU (pve), Player 1 y Player 2 vs CPU (coop), Player 1 vs Player 2 local (pvp).
- Entrada de intentos por letra o por palabra completa.
- Boton para reiniciar partida.
- Historial de letras y palabras intentadas.
- Chat local de maqueta para mensajes entre jugadores.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)
- Canvas API

## Estructura del proyecto

- index.html: estructura de la interfaz.
- styles.css: estilos visuales y responsive.
- app.js: logica del juego, validaciones y eventos.

## Como ejecutar

1. Abre la carpeta del proyecto en VS Code.
2. Ejecuta index.html en el navegador.
3. Selecciona el modo de juego.
4. Escribe una letra o palabra completa y presiona ENVIAR.

## Fragmentos de codigo

### Inicio de partida por modo

~~~javascript
function startGameSession(selectedMode) {
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
~~~

### Validacion de intento (letra o palabra)

~~~javascript
function handleGuessSubmission() {
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
}
~~~

### Reinicio de partida

~~~javascript
function restartCurrentMatch() {
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
~~~

## Entregables de Fase 2

1. Codigo fuente del videojuego con documentacion basica.
2. Ejecutable del videojuego en su version inicial.
3. Plan para implementar conexion en red en la siguiente fase.

Nota sobre ejecutable: en esta version web, el ejecutable inicial se considera la aplicacion corriendo desde index.html en navegador.

## Reglas principales

- Solo se aceptan caracteres alfabeticos.
- Una letra incorrecta suma un error.
- Una palabra completa incorrecta tambien suma un error.
- El maximo de errores es 6.
- El jugador gana cuando descubre la palabra.

## Plan de implementacion de red (Fase 3)

1. Definir arquitectura cliente-servidor para sala de juego y sincronizacion de estado.
2. Implementar backend basico con manejo de sesiones y emparejamiento de jugadores.
3. Agregar comunicacion en tiempo real para intentos, turnos y resultado de la partida.
4. Sincronizar chat entre clientes conectados.
5. Incorporar reconexion basica y validaciones de consistencia de estado.
6. Probar escenarios de latencia y desconexion para asegurar jugabilidad minima.

## Autor

Salvador Castañeda Andrade
Leonardo Navarro Real 
