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
// ------------------------------------------------------------
// SOBRE LA VELOCIDAD Y EL ESPACIADO (importante si vas a tocar esto)
// ------------------------------------------------------------
// El salto es un arco FIJO: con la gravedad y el impulso de salto que usa
// game.js, un salto completo dura ~41 frames sin importar la velocidad.
// Eso significa que el alcance horizontal de un salto es, aproximadamente:
//
//     alcance_del_salto_px ≈ 41 × speed
//
// Y el tiempo que un jugador tiene para reaccionar a un obstáculo desde
// que aparece en pantalla hasta que llega a Byte es aproximadamente:
//
//     segundos_de_reacción ≈ 770 / speed / 60
//
// Bajar `speed` no solo hace todo "más lento": alarga el tiempo real de
// reacción (menos frenético) Y acorta el alcance del salto en píxeles —
// por eso, al bajar la velocidad, los obstáculos también se reacomodaron
// más cerca entre sí en términos de píxeles (para mantener el mismo tipo
// de reto), pero el jugador tiene más tiempo real para verlos venir.
//
// Reglas usadas al diseñar el espaciado de cada nivel:
//   - Un "cluster" (2-3 obstáculos pegados que se saltan de un solo brinco)
//     mide como máximo ~50% del alcance del salto de ese nivel.
//   - Entre un obstáculo/cluster y el siguiente hay al menos ~1.1x el
//     alcance del salto, para poder aterrizar y volver a saltar a tiempo.
//   - Después de un portal de gravedad hay un colchón extra (~230-260px)
//     antes del primer obstáculo del techo, porque la transición de piso
//     a techo tarda un tramo en el que Byte no puede saltar (está "cayendo"
//     hacia arriba).
//
// Cambiar estos arreglos es la forma más fácil de rediseñar dificultad
// sin tocar la lógica del motor (game.js).
//
// ------------------------------------------------------------
// NIVELES 3-5 (versión difícil)
// ------------------------------------------------------------
// Se generaron con un simulador que replica la física de game.js paso a
// paso y busca, para cada obstáculo, el espaciado más cerrado que deja
// una "ventana de salto" (cuántos pasos de 1/60 s seguidos puedes
// presionar y aun así sobrevivir) de al menos:
//   Nivel 3 → 7 pasos · Nivel 4 → 6 pasos · Nivel 5 → 5 pasos
// Todos los niveles se verificaron como completables de principio a fin.
//
// `noLabel: true` en un pico = forma parte de un grupo de picos pegados;
// comparte la etiqueta (para el mensaje "Te detuvo…") pero no la dibuja
// para que no se encimen los textos.
// ============================================================

const GROUND_Y = 300;

const LEVELS = [
  // ---------------------------------------------------------
  // NIVEL 1 — Sintaxis Básica
  // speed 3.0 → ritmo relajado, ideal para aprender el salto fijo.
  // ---------------------------------------------------------
  {
    name: "Nivel 1: Sintaxis Básica",
    length: 4063,
    speed: 3.0,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 30, h: 40, label: ";" },
      { x: 590, type: "spike", w: 30, h: 40, label: "{" },
      { x: 760, type: "block", w: 39, h: 45, label: "typo" },
      { x: 950, type: "spike", w: 30, h: 40, label: "}" },
      { x: 1120, type: "spike", w: 30, h: 40, label: "(" },
      { x: 1286, type: "spike", w: 30, h: 40, label: ")" },
      { x: 1451, type: "gap", w: 90 },
      { x: 1681, type: "block", w: 33, h: 55, label: "indent" },
      { x: 1871, type: "spike", w: 30, h: 40, label: ";" },
      { x: 2041, type: "spike", w: 30, h: 40, label: "{" },
      { x: 2207, type: "spike", w: 30, h: 40, label: "}" },
      { x: 2373, type: "block", w: 33, h: 50, label: "typo" },
      { x: 2573, type: "spike", w: 30, h: 40, label: ":" },
      { x: 2743, type: "gap", w: 100 },
      { x: 2983, type: "block", w: 33, h: 55, label: "sangría" },
      { x: 3183, type: "spike", w: 30, h: 40, label: "!" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 2 — Errores en Tiempo de Ejecución
  // speed 3.6 → un poco más rápido, más clusters de picos.
  // ---------------------------------------------------------
  {
    name: "Nivel 2: Errores en Tiempo de Ejecución",
    length: 5186,
    speed: 3.6,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 30, h: 45, label: "NullPointer" },
      { x: 615, type: "block", w: 37, h: 60, label: "Timeout" },
      { x: 835, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 1028, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 1223, type: "gap", w: 110 },
      { x: 1498, type: "block", w: 34, h: 65, label: "StackOverflow" },
      { x: 1718, type: "spike", w: 30, h: 45, label: "Deadlock" },
      { x: 1913, type: "gap", w: 100 },
      { x: 2178, type: "spike", w: 28, h: 45, label: "IndexError" },
      { x: 2369, type: "spike", w: 28, h: 45, label: "IndexError" },
      { x: 2560, type: "spike", w: 28, h: 45, label: "IndexError" },
      { x: 2753, type: "block", w: 37, h: 60, label: "Timeout" },
      { x: 2973, type: "spike", w: 30, h: 45, label: "Crash" },
      { x: 3168, type: "gap", w: 100 },
      { x: 3433, type: "block", w: 37, h: 60, label: "NullPointer" },
      { x: 3653, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 3846, type: "spike", w: 30, h: 45, label: "Segfault" },
      { x: 4041, type: "spike", w: 30, h: 45, label: "Timeout" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 3 — Deuda Técnica en Producción
  // speed 4.6 → primer salto de dificultad: picos dobles, plataformas
  // "techo" (no saltes debajo) seguidas de un pico, y huecos con
  // obstáculo justo al aterrizar. Ventana de salto mínima: 7 pasos.
  // ---------------------------------------------------------
  {
    name: "Nivel 3: Deuda Técnica en Producción",
    length: 6365,
    speed: 4.6,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 28, h: 50, label: "Hotfix" },
      { x: 608, type: "spike", w: 26, h: 50, label: "Hotfix x2" },
      { x: 634, type: "spike", w: 26, h: 50, label: "Hotfix x2", noLabel: true },
      { x: 830, type: "block", w: 42, h: 70, label: "Legacy Code" },
      { x: 992, type: "gap", w: 120 },
      { x: 1242, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1440, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 1466, type: "spike", w: 26, h: 50, label: "Race Condition", noLabel: true },
      { x: 1722, type: "codeBug", w: 60, h: 50, code: "// TODO" },
      { x: 1922, type: "spike", w: 28, h: 50, label: "Memory Leak" },
      { x: 2090, type: "gap", w: 130 },
      { x: 2330, type: "spike", w: 26, h: 50, label: "404 · 500" },
      { x: 2356, type: "spike", w: 26, h: 50, label: "404 · 500", noLabel: true },
      { x: 2642, type: "block", w: 45, h: 70, label: "Sin Tests" },
      { x: 2827, type: "spike", w: 28, h: 50, label: "Code Smell" },
      { x: 2955, type: "platform", w: 190, floatHeight: 92, thickness: 18, label: "Monolito" },
      { x: 3205, type: "spike", w: 28, h: 50, label: "Acoplamiento" },
      { x: 3443, type: "gap", w: 125 },
      { x: 3648, type: "codeBug", w: 55, h: 50, code: "x = x;" },
      { x: 3853, type: "spike", w: 26, h: 50, label: "Code Smell" },
      { x: 3879, type: "spike", w: 26, h: 50, label: "Code Smell", noLabel: true },
      { x: 4055, type: "spike", w: 28, h: 50, label: "Spaghetti" },
      { x: 4363, type: "block", w: 40, h: 60, label: "Sin Docs" },
      { x: 4513, type: "gap", w: 130 },
      { x: 4753, type: "spike", w: 26, h: 50, label: "Hotfix x2" },
      { x: 4779, type: "spike", w: 26, h: 50, label: "Hotfix x2", noLabel: true },
      { x: 4875, type: "platform", w: 170, floatHeight: 92, thickness: 18, label: "Servidor Viejo" },
      { x: 5105, type: "spike", w: 28, h: 50, label: "Parche" },
      { x: 5353, type: "spike", w: 26, h: 45, label: "Rollback", noLabel: true },
      { x: 5379, type: "spike", w: 26, h: 45, label: "Rollback" },
      { x: 5405, type: "spike", w: 26, h: 45, label: "Rollback", noLabel: true },
      { x: 5551, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 5809, type: "block", w: 36, h: 75, label: "Deploy Viernes" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 4 — Refactor en el Aire
  // speed 5.2 → dos tramos de gravedad invertida con clusters en el
  // techo, picos triples y saltos encadenados. Ventana mínima: 6 pasos.
  // ---------------------------------------------------------
  {
    name: "Nivel 4: Refactor en el Aire",
    length: 7545,
    speed: 5.2,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 28, h: 50, label: "Off-by-one" },
      { x: 618, type: "spike", w: 26, h: 50, label: "Off-by-one" },
      { x: 644, type: "spike", w: 26, h: 50, label: "Off-by-one", noLabel: true },
      { x: 860, type: "codeBug", w: 80, h: 50, code: "if (x = 1)" },
      { x: 1000, type: "platform", w: 170, floatHeight: 92, thickness: 18, label: "Cache Layer" },
      { x: 1230, type: "spike", w: 28, h: 50, label: "Cache Miss" },
      { x: 1418, type: "gap", w: 125 },
      { x: 1763, type: "block", w: 55, h: 65, label: "Merge Conflict" },

      // --- Tramo invertido #1: Byte corre por el techo ---
      { x: 1968, type: "gravityPortal", dir: -1 },
      { x: 2228, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "NullPointer" },
      { x: 2376, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Timeout" },
      { x: 2402, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Timeout", noLabel: true },
      { x: 2618, type: "block", w: 55, h: 60, anchor: "ceiling", label: "Infinite Loop" },
      { x: 2833, type: "codeBug", w: 95, h: 50, anchor: "ceiling", code: "i <= arr.len" },
      { x: 3108, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido #1 ---

      { x: 3348, type: "codeBug", w: 90, h: 50, code: "array[i + 1]" },
      { x: 3578, type: "spike", w: 26, h: 50, label: "Stack Overflow" },
      { x: 3604, type: "spike", w: 26, h: 50, label: "Stack Overflow", noLabel: true },
      { x: 3710, type: "platform", w: 160, floatHeight: 92, thickness: 18, label: "Rate Limit" },
      { x: 3930, type: "gap", w: 130 },
      { x: 4140, type: "spike", w: 28, h: 50, label: "Throttle" },
      { x: 4418, type: "spike", w: 26, h: 45, label: "Stack Overflow", noLabel: true },
      { x: 4444, type: "spike", w: 26, h: 45, label: "Stack Overflow" },
      { x: 4470, type: "spike", w: 26, h: 45, label: "Stack Overflow", noLabel: true },

      // --- Tramo invertido #2: Byte corre por el techo ---
      { x: 4646, type: "gravityPortal", dir: -1 },
      { x: 4886, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Deadlock" },
      { x: 4912, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Deadlock", noLabel: true },
      { x: 5078, type: "block", w: 50, h: 60, anchor: "ceiling", label: "Callback Hell" },
      { x: 5288, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "Race Condition" },
      { x: 5516, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Callback Hell", noLabel: true },
      { x: 5542, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Callback Hell" },
      { x: 5568, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Callback Hell", noLabel: true },
      { x: 5774, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido #2 ---

      { x: 6024, type: "spike", w: 26, h: 50, label: "Breaking Change" },
      { x: 6050, type: "spike", w: 26, h: 50, label: "Breaking Change", noLabel: true },
      { x: 6206, type: "gap", w: 120 },
      { x: 6476, type: "codeBug", w: 60, h: 50, code: "return;" },
      { x: 6696, type: "spike", w: 26, h: 45, label: "Stack Overflow", noLabel: true },
      { x: 6722, type: "spike", w: 26, h: 45, label: "Stack Overflow" },
      { x: 6748, type: "spike", w: 26, h: 45, label: "Stack Overflow", noLabel: true },
      { x: 6974, type: "block", w: 51, h: 70, label: "Deploy Roto" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 5 — Legacy en Producción
  // speed 5.8 → el jefe final: tres tramos invertidos, picos triples
  // en piso y techo, y ritmo casi continuo. Ventana mínima: 5 pasos
  // (~83 ms): exigente pero siempre posible.
  // ---------------------------------------------------------
  {
    name: "Nivel 5: Legacy en Producción",
    length: 9717,
    speed: 5.8,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "codeBug", w: 100, h: 50, code: "while (true) {}" },
      { x: 680, type: "spike", w: 26, h: 50, label: "Race Condition", noLabel: true },
      { x: 706, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 732, type: "spike", w: 26, h: 50, label: "Race Condition", noLabel: true },
      { x: 898, type: "gap", w: 130 },
      { x: 1178, type: "spike", w: 26, h: 50, label: "Timeout" },
      { x: 1204, type: "spike", w: 26, h: 50, label: "Timeout", noLabel: true },
      { x: 1330, type: "platform", w: 180, floatHeight: 92, thickness: 18, label: "Load Balancer" },
      { x: 1570, type: "spike", w: 26, h: 50, label: "Cold Start" },
      { x: 1596, type: "spike", w: 26, h: 50, label: "Cold Start", noLabel: true },

      // --- Tramo invertido #1: Byte corre por el techo ---
      { x: 1772, type: "gravityPortal", dir: -1 },
      { x: 2032, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 2058, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak", noLabel: true },
      { x: 2214, type: "codeBug", w: 105, h: 50, anchor: "ceiling", code: "SELECT * FROM t" },
      { x: 2459, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak", noLabel: true },
      { x: 2485, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 2511, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak", noLabel: true },
      { x: 2717, type: "block", w: 55, h: 65, anchor: "ceiling", label: "Segfault" },
      { x: 2952, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido #1 ---

      { x: 3192, type: "gap", w: 140 },
      { x: 3402, type: "spike", w: 28, h: 50, label: "NullPointer" },
      { x: 3650, type: "codeBug", w: 85, h: 50, code: "catch (e) {}" },
      { x: 3805, type: "platform", w: 170, floatHeight: 92, thickness: 18, label: "CDN Edge" },
      { x: 4035, type: "spike", w: 26, h: 50, label: "Zero Day", noLabel: true },
      { x: 4061, type: "spike", w: 26, h: 50, label: "Zero Day" },
      { x: 4087, type: "spike", w: 26, h: 50, label: "Zero Day", noLabel: true },
      { x: 4283, type: "gap", w: 130 },

      // --- Tramo invertido #2: Byte corre por el techo ---
      { x: 4563, type: "gravityPortal", dir: -1 },
      { x: 4823, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Deadlock" },
      { x: 4999, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Data Race" },
      { x: 5025, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Data Race", noLabel: true },
      { x: 5261, type: "block", w: 55, h: 60, anchor: "ceiling", label: "God Object" },
      { x: 5506, type: "codeBug", w: 90, h: 50, anchor: "ceiling", code: "eval(input)" },
      { x: 5746, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Data Race", noLabel: true },
      { x: 5772, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Data Race" },
      { x: 5798, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Data Race", noLabel: true },
      { x: 6004, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido #2 ---

      { x: 6274, type: "spike", w: 26, h: 50, label: "Rollback" },
      { x: 6300, type: "spike", w: 26, h: 50, label: "Rollback", noLabel: true },
      { x: 6416, type: "gap", w: 130 },
      { x: 6706, type: "spike", w: 26, h: 50, label: "Rollback", noLabel: true },
      { x: 6732, type: "spike", w: 26, h: 50, label: "Rollback" },
      { x: 6758, type: "spike", w: 26, h: 50, label: "Rollback", noLabel: true },
      { x: 6974, type: "block", w: 50, h: 75, label: "Hotfix Viernes" },

      // --- Tramo invertido #3: Byte corre por el techo ---
      { x: 7174, type: "gravityPortal", dir: -1 },
      { x: 7434, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Legacy", noLabel: true },
      { x: 7460, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Legacy" },
      { x: 7486, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Legacy", noLabel: true },
      { x: 7642, type: "codeBug", w: 90, h: 50, anchor: "ceiling", code: "// no tocar" },
      { x: 7902, type: "block", w: 50, h: 60, anchor: "ceiling", label: "Spaghetti" },
      { x: 8132, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido #3 ---

      { x: 8402, type: "spike", w: 26, h: 50, label: "Prod Down" },
      { x: 8428, type: "spike", w: 26, h: 50, label: "Prod Down", noLabel: true },
      { x: 8544, type: "gap", w: 140 },
      { x: 8844, type: "spike", w: 26, h: 50, label: "Prod Down", noLabel: true },
      { x: 8870, type: "spike", w: 26, h: 50, label: "Prod Down" },
      { x: 8896, type: "spike", w: 26, h: 50, label: "Prod Down", noLabel: true },
      { x: 9142, type: "block", w: 55, h: 75, label: "rm -rf /" }
    ]
  }
];
