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
  // speed 4.2 → el más rápido "clásico", denso en obstáculos.
  // ---------------------------------------------------------
  {
    name: "Nivel 3: Deuda Técnica en Producción",
    length: 6268,
    speed: 4.2,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 28, h: 50, label: "Hotfix" },
      { x: 638, type: "spike", w: 28, h: 50, label: "Hotfix" },
      { x: 856, type: "block", w: 41, h: 70, label: "Legacy Code" },
      { x: 1101, type: "gap", w: 120 },
      { x: 1411, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1629, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 1847, type: "spike", w: 28, h: 50, label: "Race Condition" },
      { x: 2065, type: "block", w: 45, h: 65, label: "Sin Tests" },
      { x: 2310, type: "gap", w: 130 },
      { x: 2630, type: "spike", w: 28, h: 50, label: "Memory Leak" },
      { x: 2848, type: "block", w: 41, h: 70, label: "Refactor Urgente" },
      { x: 3093, type: "gap", w: 110 },
      { x: 3393, type: "spike", w: 28, h: 50, label: "404" },
      { x: 3611, type: "spike", w: 28, h: 50, label: "500" },
      { x: 3829, type: "block", w: 45, h: 65, label: "Bug Crítico" },
      { x: 4074, type: "spike", w: 30, h: 50, label: "Code Smell" },
      { x: 4294, type: "gap", w: 130 },
      { x: 4614, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 4832, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 5050, type: "block", w: 32, h: 75, label: "Deploy Viernes" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 4 — Refactor en el Aire
  // speed 4.8 → plataformas, bugs de código y un tramo de gravedad
  // invertida. El colchón de ~230px alrededor de cada portal le da
  // tiempo a Byte de "aterrizar" en la nueva orientación.
  // ---------------------------------------------------------
  {
    name: "Nivel 4: Refactor en el Aire",
    length: 6218,
    speed: 4.8,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "spike", w: 28, h: 50, label: "Off-by-one" },
      { x: 665, type: "spike", w: 28, h: 50, label: "Off-by-one" },
      { x: 910, type: "codeBug", w: 70, h: 50, code: "if (x = 1)" },
      { x: 1216, type: "platform", w: 160, floatHeight: 95, thickness: 18, label: "Cache Layer" },
      { x: 1592, type: "gap", w: 110 },
      { x: 1918, type: "block", w: 55, h: 65, label: "Merge Conflict" },

      // --- Tramo de gravedad invertida: Byte corre por el techo ---
      { x: 2189, type: "gravityPortal", dir: -1 },
      { x: 2419, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "NullPointer" },
      { x: 2663, type: "spike", w: 28, h: 45, anchor: "ceiling", label: "Timeout" },
      { x: 2907, type: "block", w: 55, h: 60, anchor: "ceiling", label: "Infinite Loop" },
      { x: 3192, type: "gravityPortal", dir: 1 },
      // --- fin del tramo invertido ---

      { x: 3408, type: "codeBug", w: 70, h: 50, code: "array[i + 1]" },
      { x: 3724, type: "platform", w: 150, floatHeight: 90, thickness: 18, label: "Rate Limit" },
      { x: 4090, type: "gap", w: 120 },
      { x: 4426, type: "spike", w: 28, h: 50, label: "Stack Overflow" },
      { x: 4671, type: "spike", w: 28, h: 50, label: "Stack Overflow" },
      { x: 4916, type: "block", w: 51, h: 70, label: "Deploy Roto" }
    ]
  },

  // ---------------------------------------------------------
  // NIVEL 5 — Legacy en Producción
  // speed 5.4 → el más avanzado, con DOS tramos de gravedad invertida.
  // Sigue siendo bastante más lento que la primera versión del nivel 3.
  // ---------------------------------------------------------
  {
    name: "Nivel 5: Legacy en Producción",
    length: 8009,
    speed: 5.4,
    groundY: GROUND_Y,
    obstacles: [
      { x: 420, type: "codeBug", w: 83, h: 50, code: "while (true) {}" },
      { x: 774, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 1044, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 1314, type: "spike", w: 26, h: 50, label: "Race Condition" },
      { x: 1584, type: "platform", w: 170, floatHeight: 95, thickness: 18, label: "Load Balancer" },
      { x: 1998, type: "gap", w: 120 },
      { x: 2362, type: "spike", w: 30, h: 50, label: "Timeout" },

      // --- Tramo invertido #1 ---
      { x: 2636, type: "gravityPortal", dir: -1 },
      { x: 2896, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 3166, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Memory Leak" },
      { x: 3436, type: "codeBug", w: 110, h: 50, anchor: "ceiling", code: "SELECT * FROM users;" },
      { x: 3790, type: "block", w: 55, h: 65, anchor: "ceiling", label: "Segfault" },
      { x: 4105, type: "gravityPortal", dir: 1 },
      // --- fin tramo invertido #1 ---

      { x: 4349, type: "platform", w: 160, floatHeight: 90, thickness: 18, label: "CDN Edge" },
      { x: 4753, type: "gap", w: 130 },
      { x: 5127, type: "codeBug", w: 83, h: 50, code: "catch (e) {}" },

      // --- Tramo invertido #2 ---
      { x: 5461, type: "gravityPortal", dir: -1 },
      { x: 5721, type: "spike", w: 26, h: 45, anchor: "ceiling", label: "Deadlock" },
      { x: 5991, type: "block", w: 55, h: 60, anchor: "ceiling", label: "Data Race" },
      { x: 6306, type: "gravityPortal", dir: 1 },
      // --- fin tramo invertido #2 ---

      { x: 6550, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 6822, type: "spike", w: 28, h: 50, label: "Rollback" },
      { x: 7094, type: "block", w: 50, h: 75, label: "Hotfix Viernes" }
    ]
  }
];
