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
//   "spike"  -> pico triangular sobre el piso. Choque = muerte instantánea.
//   "block"  -> bloque rectangular sobre el piso. Hay que saltarlo.
//   "gap"    -> hueco en el piso. Caer dentro = muerte instantánea.
//
// Cambiar estos arreglos es la forma más fácil de rediseñar
// dificultad sin tocar la lógica del motor (game.js).
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
  }
];
