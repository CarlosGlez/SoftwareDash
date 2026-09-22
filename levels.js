// ============================================================
// SoftwareDash — Definición de niveles
// ------------------------------------------------------------
// Cada nivel es un objeto con:
//   name      -> nombre mostrado en el HUD
//   length    -> longitud total del nivel en px (mundo, no pantalla)
//   speed     -> velocidad de scroll (px/frame a 60fps aprox.)
//   groundY   -> altura del piso (constante, 300 en un canvas de 360)
//   obstacles -> arreglo de obstáculos ordenados por posición x
//
// Tipos de obstáculo:
//   "spike"    -> pico triangular. Choque = muerte instantánea.
//   "block"    -> bloque rectangular sólido. Hay que saltarlo.
//   "gap"      -> hueco en el piso. Caer dentro = muerte instantánea.
//   "codeBug"  -> igual que "block" en física, pero se dibuja como una
//                 tarjeta de error con una línea de CÓDIGO REAL adentro
//                 (propiedad `code`). Es "literalmente" el bug.
//   "platform" -> plataforma flotante sólida. Se puede aterrizar encima
//                 si caes sobre ella; si la golpeas por abajo o de lado,
//                 mueres. También sirve como "techo bajo": puedes pasar
//                 por debajo caminando normal, pero si saltas muy alto
//                 la golpeas. Usa `floatHeight` (qué tan arriba del piso
//                 está su cara inferior) y `thickness` (grosor).
//   "gravityPortal" -> no es sólido, es un disparador de una sola vez en
//                 `x`. Al cruzarlo, la gravedad se invierte según `dir`
//                 (1 = normal/piso, -1 = invertida/techo) y se mantiene
//                 así hasta el siguiente portal. Mientras está invertida,
//                 Byte "camina" por el techo (y = 0).
//
// `spike`, `block` y `codeBug` aceptan opcionalmente `anchor: "ceiling"`
// para colgar del techo en vez del piso — se usa dentro de tramos de
// gravedad invertida, donde el techo es la superficie por la que corres.
//
// Cambiar estos arreglos es la forma más fácil de rediseñar
// dificultad sin tocar la lógica del motor (game.js). La dificultad de
// los niveles 4 y 5 viene de COMBINAR obstáculos, no de subir mucho la
// velocidad (los incrementos de `speed` son pequeños a propósito).
// ============================================================

const GROUND_Y = 300;

const LEVELS = [
  // ---------------------------------------------------------
  // NIVEL 1 — Sintaxis Básica
  // Ritmo lento, obstáculos espaciados, para aprender el salto.
  // ---------------------------------------------------------
  {
    name: "Nivel 1: Sintaxis Básica",
    length: 3200,
    speed: 4.2,
    groundY: GROUND_Y,
    obstacles: [
      { x: 500,  type: "spike", w: 30, h: 40, label: ";" },
      { x: 800,  type: "spike", w: 30, h: 40, label: "{" },
      { x: 1100, type: "block", w: 50, h: 45, label: "typo" },
      { x: 1500, type: "spike", w: 30, h: 40, label: "}" },
      { x: 1500 + 60, type: "spike", w: 30, h: 40, label: ";" },
      { x: 1900, type: "gap",   w: 90 },
      { x: 2250, type: "block", w: 50, h: 55, label: "indent" },
      { x: 2600, type: "spike", w: 30, h: 40, label: "(" },
      { x: 2600 + 60, type: "spike", w: 30, h: 40, label: ")" },
      { x: 2950, type: "block", w: 60, h: 50, label: "typo" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 2 — Errores en Tiempo de Ejecución
  // Más rápido, obstáculos dobles y huecos más anchos.
  // ---------------------------------------------------------
  {
    name: "Nivel 2: Errores en Tiempo de Ejecución",
    length: 3900,
    speed: 5.6,
    groundY: GROUND_Y,
    obstacles: [
      { x: 450,  type: "spike", w: 30, h: 45, label: "NullPointer" },
      { x: 780,  type: "block", w: 55, h: 60, label: "Timeout" },
      { x: 1100, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 1100 + 55, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 1450, type: "gap",   w: 110 },
      { x: 1750, type: "block", w: 55, h: 65, label: "StackOverflow" },
      { x: 2050, type: "spike", w: 30, h: 45, label: "Deadlock" },
      { x: 2300, type: "gap",   w: 100 },
      { x: 2600, type: "spike", w: 30, h: 45, label: "IndexError" },
      { x: 2600 + 55, type: "spike", w: 30, h: 45, label: "IndexError" },
      { x: 2600 + 110, type: "spike", w: 30, h: 45, label: "IndexError" },
      { x: 3000, type: "block", w: 55, h: 60, label: "Timeout" },
      { x: 3350, type: "gap",   w: 100 },
      { x: 3650, type: "spike", w: 30, h: 45, label: "Crash" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 3 — Deuda Técnica en Producción
  // Rápido, denso, combina picos + huecos + bloques altos.
  // ---------------------------------------------------------
  {
    name: "Nivel 3: Deuda Técnica en Producción",
    length: 4700,
    speed: 7.0,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420,  type: "spike", w: 28, h: 50, label: "Hotfix" },
      { x: 420 + 50, type: "spike", w: 28, h: 50, label: "Hotfix" },
      { x: 750,  type: "block", w: 55, h: 70, label: "Legacy Code" },
      { x: 1050, type: "gap",   w: 120 },
      { x: 1350, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1350 + 50, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1350 + 100, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1700, type: "block", w: 55, h: 65, label: "Sin Tests" },
      { x: 2000, type: "gap",   w: 130 },
      { x: 2350, type: "spike", w: 28, h: 50, label: "Memory Leak" },
      { x: 2600, type: "block", w: 55, h: 70, label: "Refactor Urgente" },
      { x: 2900, type: "gap",   w: 110 },
      { x: 3200, type: "spike", w: 28, h: 50, label: "404" },
      { x: 3200 + 50, type: "spike", w: 28, h: 50, label: "500" },
      { x: 3550, type: "block", w: 55, h: 65, label: "Bug Crítico" },
      { x: 3850, type: "gap",   w: 130 },
      { x: 4150, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 4150 + 50, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 4400, type: "block", w: 60, h: 75, label: "Deploy Viernes" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 4 — Refactor en el Aire
  // Casi la misma velocidad que el nivel 3 (sube poquito): la dificultad
  // nueva viene de plataformas flotantes, bugs de código reales y un
  // primer tramo de gravedad invertida.
  // ---------------------------------------------------------
  {
    name: "Nivel 4: Refactor en el Aire",
    length: 4450,
    speed: 7.3,
    groundY: GROUND_Y,
    obstacles: [
      { x: 400, type: "spike", w: 28, h: 50, label: "Off-by-one" },
      { x: 400 + 50, type: "spike", w: 28, h: 50, label: "Off-by-one" },
      { x: 750, type: "codeBug", w: 90, h: 50, code: "if (x = 1)" },
      { x: 1050, type: "platform", w: 160, floatHeight: 95, thickness: 18, label: "Cache Layer" },
      { x: 1330, type: "gap", w: 110 },
      { x: 1580, type: "block", w: 55, h: 65, label: "Merge Conflict" },

      // --- Tramo de gravedad invertida: Byte corre por el techo ---
      { x: 1850, type: "gravityPortal", dir: -1 },
      { x: 1980, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "NullPointer" },
      { x: 2230, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "Timeout" },
      { x: 2480, type: "block", w: 55, h: 60, anchor: "ceiling", label: "Infinite Loop" },
      { x: 2780, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido ---

      { x: 2980, type: "codeBug", w: 100, h: 50, code: "array[i + 1]" },
      { x: 3300, type: "platform", w: 150, floatHeight: 90, thickness: 18, label: "Rate Limit" },
      { x: 3580, type: "gap", w: 120 },
      { x: 3880, type: "spike", w: 28, h: 50, label: "Stack Overflow" },
      { x: 3880 + 50, type: "spike", w: 28, h: 50, label: "Stack Overflow" },
      { x: 4180, type: "block", w: 60, h: 70, label: "Deploy Roto" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 5 — Legacy en Producción
  // El más difícil, pero con solo un poco más de velocidad que el 4.
  // Combina todo: bugs de código, plataformas y DOS tramos de gravedad
  // invertida seguidos de clusters de picos más cerrados.
  // ---------------------------------------------------------
  {
    name: "Nivel 5: Legacy en Producción",
    length: 5050,
    speed: 7.6,
    groundY: GROUND_Y,
    obstacles: [
      { x: 380, type: "codeBug", w: 110, h: 50, code: "while (true) {}" },
      { x: 650, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 650 + 48, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 650 + 96, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 1000, type: "platform", w: 170, floatHeight: 95, thickness: 18, label: "Load Balancer" },
      { x: 1280, type: "gap", w: 120 },

      // --- Tramo invertido #1 ---
      { x: 1550, type: "gravityPortal", dir: -1 },
      { x: 1650, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 1650 + 45, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 1950, type: "codeBug", w: 110, h: 50, anchor: "ceiling", code: "SELECT * FROM users;" },
      { x: 2250, type: "block", w: 55, h: 65, anchor: "ceiling", label: "Segfault" },
      { x: 2550, type: "gravityPortal", dir: 1 },
      // --- fin tramo invertido #1 ---

      { x: 2750, type: "platform", w: 160, floatHeight: 90, thickness: 18, label: "CDN Edge" },
      { x: 3020, type: "gap", w: 130 },
      { x: 3280, type: "codeBug", w: 90, h: 50, code: "catch (e) {}" },

      // --- Tramo invertido #2 ---
      { x: 3560, type: "gravityPortal", dir: -1 },
      { x: 3680, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Deadlock" },
      { x: 3950, type: "block", w: 55, h: 60, anchor: "ceiling", label: "Data Race" },
      { x: 4230, type: "gravityPortal", dir: 1 },
      // --- fin tramo invertido #2 ---

      { x: 4430, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 4430 + 50, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 4730, type: "block", w: 60, h: 75, label: "Hotfix Viernes" }
    ]
  }
];
