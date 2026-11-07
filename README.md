# Platinum Guesser

Juego web para poner a prueba tu memoria: ¿te acuerdas de **todos** los juegos en los que has conseguido el trofeo de platino en PlayStation?

Introduces tu usuario de PSN, se cargan tus platinos ordenados por fecha y tienes que ir adivinándolos uno a uno escribiendo su nombre.

## Cómo se juega

- **Buscador**: escribe el nombre de un juego y elige entre las sugerencias (solo juegos de PS3, PS4, PS5 y PS Vita, con su portada). Si tienes su platino, se revela; si no, va a la lista de errores.
- **Progreso**: inventario lateral con una casilla por platino, numeradas por orden de obtención. Si tienes el platino de un juego en varias versiones (PS4 y PS5), se revelan todas a la vez.
- **Monedas y pistas**: ganas 1 moneda por cada platino acertado y las gastas en pistas:
  - Fecha del platino, plataformas o año de salida: 1 moneda.
  - Una palabra del nombre: 3 monedas.
  - Pulsa una casilla del progreso para pedir pistas de ese juego; si no eliges ninguna, se elige una al azar.
- **Historial**: cada partida guarda tiempo jugado, porcentaje, pistas, monedas gastadas y errores. Puedes salir y reanudarla después; el reloj solo corre mientras juegas.

## Tecnología

- `client/`: React + Vite + TypeScript.
- `server/`: Node.js + Fastify + TypeScript, con SQLite (`node:sqlite`) como caché local en `data/`.
- Datos de trofeos: [`psn-api`](https://github.com/achievements-app/psn-api).
- Catálogo de juegos y portadas: [IGDB](https://api-docs.igdb.com/).

## Puesta en marcha

Requiere Node.js 22.13 o superior.

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y rellena las credenciales:
   - `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET`: crea una aplicación en https://dev.twitch.tv/console/apps.
   - `PSN_NPSSO`: token de tu sesión de PlayStation (inicia sesión en playstation.com y abre https://ca.account.sony.com/api/v1/ssocookie). Lee antes el aviso de abajo.
3. Arranca cliente y servidor:
   ```bash
   npm run dev
   ```
4. Abre http://localhost:5173.

## ⚠️ Aviso sobre PSN

`psn-api` usa la API **interna y no oficial** de Sony. Usarla va en contra de los términos de servicio de PlayStation y **puede provocar el bloqueo o la suspensión de tu cuenta**, sobre todo si se hacen muchas peticiones en poco tiempo.

Para minimizar el riesgo, la app solo llama a PSN al cargar un perfil por primera vez (o al marcar «Volver a descargar»); después todo se juega desde la caché local. Aun así, úsala bajo tu propia responsabilidad.

## Datos locales

- `data/platino.db` guarda perfiles, platinos, emparejamientos con IGDB y partidas. No se sube al repositorio.
- Las imágenes no se descargan: se guardan solo sus URLs y el navegador las carga bajo demanda.
- El logo del trofeo puede sustituirse colocando una imagen en `client/public/platinum.png`.
