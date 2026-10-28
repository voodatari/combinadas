# Historial de cambios

Formato de versión: `X.Y.Z`, igual que el número que llevan los archivos en `index.html` (`?v=…`) y la cinta del menú principal.

## [1.1.0] - 2026-10-28
Revisión completa de la primera versión (que se llamaba «Múltiples») y dos novedades.

- **Nombre**: el juego pasa a llamarse **Combinadas** (operaciones combinadas). Carpeta, textos, título de la página y prefijo de localStorage (`combinadas.`) cambian; los ajustes de la versión anterior no se conservan.
- **Nivel 3: tres pasos como mínimo.** El motor ya no está atado a «3 números y 2 operaciones»: una operación es una lista de fichas con N números y N−1 pasos. El nivel 3 genera 4 números con paréntesis (`(4 + 3) × 5 − 2`, `8 + 3 × (9 − 4)`, `(12 + 8) − (3 + 2)`, `10 − 3 × 2 + 4`…) y los niveles 1 y 2 siguen con 2 pasos. Los paréntesis tienen que servir para algo (sin ellos sale otro resultado).
  - «Paso a paso» sigue tantas preguntas como pasos (indicador «paso 2 de 3»); «Arrastrar» monta lo que queda (5 huecos, con los paréntesis ya puestos); la explicación resuelve un paso tras otro.
  - Un cuarto color para los números (el 4.º, rosa) y el verde de los resultados, que antes no estaban definidos en el CSS.
- **Voz de las explicaciones: Piper o voz del navegador** (⚙️ Opciones). La del navegador usa la Web Speech API y elige sola la voz española más adecuada: de España, de mujer (como Piper) y lo más natural posible (Edge «Elvira Online (Natural)», Chrome «Google español», Windows «Helena», Apple «Mónica»). No descarga nada: con ella no se carga Piper. Hay un botón «Probar» y la nota indica qué voz suena.
- **Fallos corregidos**
  - «¿Cuál va primero?» ofrecía como mala la misma operación que la buena sin paréntesis (`4 + 3` frente a `(4 + 3)`) y mostraba 4 botones en una cuadrícula de 3 (la tecla 4 no hacía nada): ahora siempre 3 opciones.
  - Una opción «mala» podía valer igual que la buena (operaciones independientes, como `2 × 3` en `2 × 3 + 4 × 5`; o `a + c` en `a − b + c`): ya no se ofrecen. Se comprueba al generar cada pregunta.
  - Distractores absurdos (`7 × 200`, 1550 para un 145): se prefieren los errores típicos de resultado cercano.
  - «Paso a paso»: al fallar en el último paso, la explicación enseñaba como correcta la operación en vez del valor y comparaba con la operación entera. Ahora se explica desde el paso en que se falló.
  - Explicación de «¿Cuál va primero?»: las comprobaciones con números usaban pares sin sentido (`(4 × 5) + 3`); ahora se calcula de verdad qué saldría empezando por ahí, siguiendo la regla.
  - Faltaban en el CSS el verde de los resultados (`rol-r`) y el color de los números sueltos.
  - Textos que seguían hablando de «Múltiples» y de «operaciones múltiples»; `prueba.js` y el servidor de desarrollo apuntaban a rutas que no existían.
- **Estructura del proyecto** como el resto (`web/` se publica, `herramientas/` es el taller, `copias/`, `proyecto.json`, `probar-en-local.bat`). La prueba del motor es ahora `node herramientas/probar-comb.js` (comprueba pasos, totales con un cálculo independiente, opciones y arrastre en más de 20.000 operaciones).

## [1.0.0] - 2026-10-28
Primera versión («Múltiples», hecha con GLM-5.3-Flash a partir de la distributiva). Parte del código de [Distributiva](https://github.com/voodatari/distributiva) (pantallas, modos, ranking local, ajustes, voz Piper en el navegador, música, arrastre, explicaciones, escala fija y vista móvil), con contenido nuevo: el **orden de las operaciones** en 5.º de primaria.

- **Actividades**: ¿Cuál va primero?, Elige la igualdad, Paso a paso, Arrastrar y Todo junto.
- **Operaciones**: siempre 3 números y 2 operaciones, en 4 formas (`4 + 3 × 5`, `10 − 6 + 2`, `(4 + 3) × 5`, `4 × (3 + 5)`); divisiones exactas, sin resultados negativos.
- **Explicación animada y narrada al fallar** (o escrita, con los mismos textos), con la técnica FLIP.
- **Modos**: Contrarreloj, Muerte súbita, Supervivencia y Práctica; «Explicar los fallos» (No · En práctica · Siempre) y «Ver la respuesta al fallar».
- Todo local: ranking, nombre y ajustes en localStorage. La voz comparte caché de síntesis con la distributiva (prefijo `distributiva-voz-` en el worker, a propósito) para no descargar los ~75 MB dos veces.
