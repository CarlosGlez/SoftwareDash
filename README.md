# SoftwareDash

Juego web tipo *Geometry Dash* ambientado en el ciclo de vida del desarrollo de software.
Proyecto de la asignatura **Nuevas Tecnologías** — Ingeniería en Sistemas y Negocios Digitales (ISND).

## Descripción

Controlas a **Byte**, un proceso de compilación que avanza automáticamente por tres etapas del
desarrollo de software. Tu única acción es **saltar** en el momento correcto para esquivar los
obstáculos, que representan errores reales de programación (errores de sintaxis, excepciones en
tiempo de ejecución y deuda técnica en producción). Chocar reinicia el intento; llegar al final del
nivel lo supera.

## Objetivo del juego

Completar los 3 niveles esquivando todos los obstáculos, minimizando el número de intentos y el
tiempo. Los resultados se guardan en un ranking en línea (Supabase) para que cualquier jugador
pueda comparar su desempeño.

## Integrantes

- Carlos González
- Itzel Alejandra
- Pablo Govea

## Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| HTML5 Canvas | Renderizado del juego (obstáculos, jugador, fondo) |
| JavaScript (vanilla) | Motor del juego: física, colisiones, máquina de estados |
| CSS3 | Interfaz, pantallas de inicio/derrota/victoria, HUD |
| Web Audio API | Retroalimentación sonora (salto, choque, victoria) sin archivos externos |
| **Supabase** (Postgres + API REST) | Tecnología nueva #1 — persistencia del progreso y ranking en línea |
| **Supabase JS Client (CDN)** | Consumo de la API de Supabase desde el navegador |

> Nota: si se quiere sumar una segunda tecnología emergente (por ejemplo IA generativa para crear
> niveles nuevos automáticamente, o QR para invitar a otros jugadores desde el celular), este
> proyecto está estructurado para agregarla sin tocar el motor del juego — ver sección
> "Cómo extenderlo".

## Controles

- **Espacio**, **clic** o **toque en pantalla**: saltar.
- Mantener presionado = salto más alto (soltar antes corta el salto).
- El avance horizontal es automático; el jugador solo controla el salto.

## Arquitectura

```
softwaredash/
├── index.html            # Estructura de pantallas (inicio, juego, derrota, victoria, ranking)
├── style.css             # Estilos de toda la interfaz
├── levels.js             # Datos de los 3 niveles (obstáculos, longitud, velocidad)
├── supabase-config.js    # Configuración y funciones de acceso a Supabase (+ fallback localStorage)
└── game.js               # Motor: física, colisiones, máquina de estados, dibujo, sonido, UI
```

**Flujo de datos:**

1. `levels.js` define los obstáculos de cada nivel como datos puros (arreglos), separados de la
   lógica del juego. Esto permite agregar o rediseñar niveles sin tocar el motor.
2. `game.js` corre el bucle principal (`requestAnimationFrame`): actualiza física → revisa
   colisiones contra los obstáculos del nivel activo → dibuja el frame en el `<canvas>`.
3. Al completar un nivel, `game.js` llama a `saveScore()` (definida en `supabase-config.js`), que
   inserta el resultado en la tabla `scores` de Supabase. Si Supabase no está configurado, el
   resultado se guarda en `localStorage` como respaldo, sin romper el flujo del juego.
4. El ranking (`getTopScores()`) consulta esa misma tabla ordenada por tiempo y alimenta la
   pantalla de "Ranking".

**Máquina de estados** (variable `STATE` en `game.js`): `START → PLAYING → (FAIL | LEVEL_COMPLETE) → PLAYING → ... → VICTORY`.

## Configuración de Supabase

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecutar:
   ```sql
   create table scores (
     id bigint generated always as identity primary key,
     player_name text not null,
     level int not null,
     time_ms int not null,
     attempts int not null,
     created_at timestamp with time zone default now()
   );

   alter table scores enable row level security;
   create policy "allow read" on scores for select using (true);
   create policy "allow insert" on scores for insert with check (true);
   ```
3. En **Settings → API**, copiar el `Project URL` y la `anon public key`.
4. Pegarlos en `supabase-config.js`:
   ```js
   const SUPABASE_URL = "https://tuproyecto.supabase.co";
   const SUPABASE_ANON_KEY = "tu-anon-key";
   ```
5. Listo — sin esto configurado, el juego sigue funcionando con progreso guardado localmente
   (localStorage), útil para desarrollar antes de tener el proyecto de Supabase listo.

## Cómo correrlo localmente

No requiere instalación ni build. Basta con servir la carpeta como sitio estático:

```bash
cd softwaredash
python3 -m http.server 8000
# abrir http://localhost:8000 en el navegador
```

(Abrir `index.html` directamente con doble clic también funciona en la mayoría de navegadores,
aunque algunos bloquean `fetch`/módulos por CORS si se abre como `file://`; servirlo con un
servidor local evita ese problema.)

## Publicación en GitHub Pages

1. Subir esta carpeta a un repositorio de GitHub.
2. Ir a **Settings → Pages**.
3. En "Branch", elegir `main` (o la rama correspondiente) y la carpeta raíz (`/`).
4. Guardar. GitHub Pages entrega una URL pública en un par de minutos.
5. Verificar que el juego cargue y sea jugable **desde otra computadora** (requisito del reto).

## Enlace público

`[Pegar aquí la URL de GitHub Pages una vez publicado]`

## Cómo extenderlo

- **Más niveles**: agregar un objeto nuevo al arreglo `LEVELS` en `levels.js`.
- **IA generativa**: se puede pedir a un modelo que genere el arreglo `obstacles` de un nivel en
  formato JSON (mismo esquema que los niveles actuales) para tener niveles infinitos.
- **Control desde celular (QR)**: se podría generar un código QR que abra una página simple con un
  botón "saltar" que envíe el evento por WebSocket/Supabase Realtime al juego en la pantalla
  principal, para partidas cooperativas o de exhibición.

## Evidencia de desarrollo

Se recomienda documentar en el repositorio (commits, capturas de versiones intermedias, errores
encontrados y decisiones de diseño) conforme lo pide el reto, ya que la evaluación considera el
proceso y no solo el resultado final.
