# Combinadas

**▶ Jugar: abrir `index.html`** (funciona en el navegador del ordenador, la tablet o el móvil; no hace falta instalar nada. Para que la música en bucle y la voz Piper vayan bien, mejor servirlo por http: ver `probar-en-local.bat`)

Juego de aula (5.º de primaria) para trabajar las **operaciones combinadas** (el orden de las operaciones): primero el **paréntesis**, luego **× y ÷**, después **+ y −**; del mismo nivel, de **izquierda a derecha**.

    ( )  →  × ÷  →  + −

Sin cuentas ni base de datos: el ranking, el nombre y los ajustes se guardan en el navegador.

## Actividades

| Actividad | Qué se hace |
|---|---|
| 🔎 **¿Cuál va primero?** | Se ve una operación: ¿qué operación hay que resolver **primero**? (el primer paso real y dos «pasos trampa»: empezar por la izquierda, saltarse un número, usar la operación equivocada…) |
| ⚖️ **Elige la igualdad** | Tres operaciones; ¿cuál queda después de resolver el primer paso? (los errores clásicos: empezar por la izquierda, cambiar la operación, ignorar el paréntesis…) |
| 🪜 **Paso a paso** | Se plantea una operación combinada y en cada pregunta se resuelve **un paso**: primero ¿cómo queda? y al final ¿cuánto vale? La misma operación sigue de pregunta en pregunta hasta la solución (el indicador dice «paso 2 de 3») |
| ✋ **Arrastrar** | Se resuelve el primer paso y se monta **lo que queda** moviendo números y operaciones (+ − × ÷) a los huecos; los de operación son violetas y los paréntesis que quedan ya vienen puestos (ratón o dedo; también tocar pieza y luego hueco) |
| 🧩 **Todo junto** | Las cuatro mezcladas |

## Niveles

| Nivel | Operaciones | Pasos |
|---|---|---|
| 🌱 1 | `4 + 3 × 5`, números del 2 al 9 | 2 |
| 🌿 2 | también restas, divisiones exactas y dos operaciones del mismo nivel: `10 − 6 + 2`, `12 ÷ 3 × 4` (números del 2 al 12) | 2 |
| 🌳 3 | **cuatro números y paréntesis**: `(4 + 3) × 5 − 2`, `8 + 3 × (9 − 4)`, `(12 + 8) − (3 + 2)` (números del 2 al 20) | **3 como mínimo** |
| 🎲 Mixto | los tres niveles | 2 o 3 |

Las divisiones siempre son **exactas**, no hay resultados negativos y todos los números y resultados son distintos entre sí (una sola forma válida de resolverla). Los paréntesis del nivel 3 siempre sirven para algo (sin ellos saldría otro resultado). En «¿Cuál va primero?» nunca se ofrece como mala una opción que también valdría (dos operaciones independientes, como `2 × 3` y `4 × 5` en `2 × 3 + 4 × 5`).

## Modos

⏱️ Contrarreloj (30/60/90/120 s) · 💀 Muerte súbita · ❤️ Supervivencia (3 vidas y un reloj que se acelera) · 🎓 Práctica.

## Cuando se falla

«Explicar los fallos»: No · En práctica · **Siempre** (por defecto). El juego y el reloj se paran mientras se explica. La explicación (animada y narrada, o escrita con los mismos textos):

1. Muestra la operación y las dos etiquetas «Tu respuesta» / «Correcta».
2. Si el alumno empezó por otro paso, **comprueba con números** qué habría salido.
3. Recuerda la regla del orden y resalta lo que va primero (los números en colores: 1.º amarillo, 2.º azul, 3.º naranja, 4.º rosa).
4. **Resuelve un paso tras otro**: las mismas fichas se funden en el resultado verde (técnica FLIP) y la operación queda más corta.
5. Termina la operación con la cuenta completa y resume con la regla.

En «Paso a paso» la explicación empieza donde se falló (con los pasos anteriores ya hechos).

Controles: Atrás · Pausa/Seguir · Repetir · Adelante, puntos de paso, flechas del teclado, Saltar / ¡Entendido!.

## Voz de las explicaciones

En ⚙️ Opciones → **Voz de las explicaciones** se elige el motor (se guarda en el navegador):

- **🎙️ Piper** (por defecto): voz natural de mujer (es_ES, Sharvard) generada en el propio dispositivo con WebAssembly. La primera visita descarga unos 75 MB y después queda guardada y funciona sin conexión.
- **🌐 Navegador**: usa la voz española que tenga instalado el dispositivo (Web Speech API), sin descargar nada. Elige sola la más adecuada: español de España, de mujer (como Piper) y lo más natural posible (Edge: «Microsoft Elvira Online (Natural)» · Chrome: «Google español» · Windows: «Helena» · Apple: «Mónica»). Las opciones indican cuál suena. Si el dispositivo no tiene ninguna voz en español, la explicación sigue escrita y animada, sin voz.
- **🔊 Probar** lee una frase con el motor elegido.

Si ninguna voz carga, el juego sigue con la explicación escrita.

## Requisitos y notas

- Navegador moderno (Chrome, Edge, Firefox, Safari).
- La música de `1`, `2`, `3` y `fin` está en OGG: las versiones antiguas de Safari (iPhone/iPad) pueden no reproducirla; el resto del juego funciona igual.
- Tras una actualización, recarga sin caché (Ctrl + F5; en iPhone, cerrar y abrir la pestaña) si se sigue viendo la versión anterior.
- Ni este juego ni [la distributiva](https://github.com/voodatari/distributiva) guardan nada en común: cada uno tiene sus ajustes, ranking y registro propios (prefijos `combinadas.` y `distributiva.` en localStorage). La **voz Piper**, en cambio, se comparte (misma carpeta `piper/` y misma caché de síntesis) para no descargarla dos veces.

## Archivos

`operaciones.js` (motor: una operación es una lista de fichas con N números y N−1 pasos; generación, regla del orden, opciones de cada actividad, comprobación del arrastre; también funciona en Node) · `app.js` (pantallas, modos, partida, ranking, máquina de estados de «Paso a paso») · `arrastre.js` (arrastrar y soltar) · `infografia.js` (explicación animada) · `explicacion.js` (versión escrita) · `voz.js` (Piper + voz del navegador) · `voz-worker.js` + `piper/` (Piper en un Web Worker) · `voz-ui.js` (opciones de voz) · `escala.js` (escala fija y clases móviles) · `sonido.js`, `bucle.js`, `fondo.js`, `efectos.js`, `rendimiento.js`, `ajustes.js`.

`herramientas/probar-comb.js` (fuera de `web/`) es una prueba automatizada del motor: `node herramientas/probar-comb.js` genera miles de operaciones y valida pasos, totales, opciones y plantillas.
