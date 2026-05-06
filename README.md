# Ahorcado Fase 3 (Red)

Juego de Ahorcado hecho con HTML, CSS, JavaScript y un servidor con Socket.IO.
Esta versión corresponde a la Fase 3 de red, donde el servidor administra la partida, sincroniza a los jugadores y decide el estado del juego en tiempo real.
Incluye modo en red, dibujo del ahorcado en canvas, chat entre jugadores y soporte para adivinar letras o palabras completas.

## Contexto academico

Este proyecto corresponde a la Entrega 3: Fase 3 - Desarrollo del Videojuego con Conexion en Red.
El objetivo de esta fase es llevar la logica del videojuego a un entorno cliente-servidor, donde el servidor controla el estado de la partida, valida las jugadas, administra los turnos y sincroniza a los jugadores conectados.

## Como funciona la red

- El cliente solo envía acciones: unirse, comenzar partida, intentar letras o palabras y enviar mensajes de chat.
- El servidor es la fuente de verdad: valida cada intento, actualiza el estado y envía la informacion a los clientes.
- El estado que recibe el navegador es publico y no expone la palabra secreta mientras la ronda esta activa.
- En PvP, cada jugador juega desde su propia ventana y el servidor coordina ambos lados de la partida.

## Caracteristicas

- Interfaz web responsive.
- 3 modos de juego: Player vs CPU (pve), Player 1 y Player 2 cooperativo (coop), Player 1 vs Player 2 simetrico (pvp).
- Entrada de intentos por letra o por palabra completa.
- Boton para iniciar o reiniciar partida.
- Historial de letras y palabras intentadas.
- Chat para mensajes entre jugadores.
- Estado sincronizado desde el servidor.
- Partidas multijugador en tiempo real.
- Control de turnos y fin de partida desde el servidor.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)
- Canvas API
- Node.js
- Express
- Socket.IO

## Estructura del proyecto

- `index.html`: estructura de la interfaz.
- `styles.css`: estilos visuales y responsive.
- `app.js`: logica del cliente, renderizado y eventos de usuario.
- `server.js`: logica del servidor, sincronizacion y validacion de la partida.

## Como ejecutar

1. Abre la carpeta del proyecto en VS Code.
2. Abre una terminal en la carpeta del proyecto.
3. Instala dependencias si hace falta:
```bash
npm install
```
4. Ejecuta el servidor:
```bash
node server.js
```
   o, si tu `package.json` tiene el script correspondiente:
```bash
npm start
```
5. Abre `http://localhost:3000` en el navegador.
6. Si vas a jugar en modo PvP o cooperativo, abre otra ventana o usa otro navegador para el segundo jugador.
7. Selecciona el modo de juego y escribe una letra o palabra completa para comenzar.

## Fragmentos de codigo

### Inicio de partida por modo

~~~javascript
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
~~~

### Validacion de intento (letra o palabra)

~~~javascript
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
~~~

### Reinicio de partida

~~~javascript
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
~~~

## Entregables de Fase 3

1. Codigo fuente del videojuego con logica en red.
2. Ejecutable web del videojuego en su version conectada.
3. Implementacion del servidor como fuente de verdad para la partida.
4. Sincronizacion de jugadores y chat en tiempo real.

Nota sobre ejecutable: en esta version web, el ejecutable se considera la aplicacion corriendo desde `server.js` y accediendo desde el navegador en `http://localhost:3000`.

## Reglas principales

- Solo se aceptan caracteres alfabeticos.
- Una letra incorrecta suma un error.
- Una palabra completa incorrecta tambien suma un error.
- El maximo de errores es 6.
- El jugador gana cuando descubre la palabra.
- En `pvp`, ambas palabras deben tener la misma longitud.
- En `pvp`, la palabra secreta no se revela hasta que termina la ronda.

## Autor

Salvador Castañeda Andrade
Leonardo Navarro Real
