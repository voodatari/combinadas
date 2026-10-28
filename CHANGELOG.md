# Historial de cambios

Formato de versión: `X.Y.Z`, igual que el número que llevan los archivos en `index.html` (`?v=…`) y la cinta del menú principal.

## [1.2.12] - 2026-10-28
- **Carteles de «¡Velocidad luz!» y «¡Qué rápido!» en «Paso a paso»**: ya no suben flotando por encima de las operaciones que se reducen y suben. Ahora se quedan quietos justo encima del historial (en el hueco entre la pregunta y las operaciones), con un pequeño rebote al aparecer y un desvanecimiento al irse; si el hueco es pequeño (móvil) el cartel se reduce hasta caber. En las demás actividades siguen como antes.

## [1.2.11] - 2026-10-28
- **«Paso a paso»: la animación empieza en el momento de acertar.** Antes había una pausa de 0,64 s con la respuesta en verde y solo después subía la operación; ahora la operación empieza a subir y reducirse en cuanto se pulsa la opción correcta (los botones viejos, en verde, se quedan hasta que se voltean). En estos pasos intermedios no se escribe la nota de la solución, que se borraría al instante; al acertar el último paso (cuando viene una operación nueva) se mantiene la pausa y la nota.

## [1.2.10] - 2026-10-28
- **«Paso a paso»: toda la animación un 20 % más rápida**: la pausa tras acertar (0,8 → 0,64 s), la subida y reducción de la operación (0,8 → 0,64 s), el desvanecimiento del «= ?» (0,16 → 0,13 s) y el volteo de las tarjetas (cada vuelta entera 0,29 → 0,23 s, con la misma cascada: cada una empieza cuando la anterior va por la mitad). De acertar a poder contestar la siguiente pasa de unos 2,2 s a 1,8 s.

## [1.2.9] - 2026-10-28
- **Volteo de los botones en cascada de verdad, y un 20 % más rápido.** Cada tarjeta tarda ahora 0,29 s en dar su vuelta entera (media vuelta para irse y media para que salga la nueva; antes 0,36 s). La del centro empieza cuando la de la izquierda va por la mitad de su vuelta, y la de la derecha cuando la del centro va por la mitad. Todo el volteo dura unos 0,6 s.

## [1.2.8] - 2026-10-28
- **«Paso a paso»: el «= ?» ya no desaparece de golpe.** Antes, al empezar a subir la operación resuelta, el signo `= ?` se quitaba al instante y se notaba un salto. Ahora viaja con la operación (pegado a su derecha, sin alterar su posición) y se desvanece con un fundido rápido (0,16 s) cuando ya está colocada en el historial. Además la operación sale del sitio exacto donde estaba su parte izquierda.
- **Botones: giran sobre el eje vertical, de izquierda a derecha y uno detrás de otro.** Empieza el de la izquierda (el viejo gira media vuelta y por la otra cara sale el nuevo); poco antes de que acabe, empieza el del centro, y poco antes de que acabe el del centro, el de la derecha. La operación nueva se sigue volteando sobre el eje horizontal. Todo dura unos 1,1 s.

## [1.2.7] - 2026-10-28
- **«Paso a paso»: tarjetas que se voltean en vez de fundidos.** Cuando la operación anterior ha terminado de subir, cada botón viejo gira hasta quedar de canto y, por la otra cara, sale el botón nuevo (uno detrás de otro; ver 1.2.8 para el eje y el orden); la operación nueva también se voltea sobre el eje horizontal. Todo dura unos 0,65 s. Los botones nuevos acaban sin ninguna transformación, así que el efecto al pasar el ratón sigue funcionando.

## [1.2.6] - 2026-10-28
- **Cuentas aún más fáciles**: ningún número ni resultado de un paso pasa de **30** (antes 100). Las multiplicaciones siguen siendo de tablas (un factor de 10 o menos) y se divide entre 10 o menos. Vale también para las respuestas malas, la bandeja de «Arrastrar» y lo que enseña la explicación. En el nivel 3 los números van del 2 al 15 (antes del 2 al 20): con el tope de 30 se generan más rápido y siempre salen. Ejemplos del nivel 3: `7 + 2 × 8 − 3`, `(3 + 12) × 2 − 9`, `9 + 4 × (13 − 8)`.
- Los fundidos de «Paso a paso» (operación nueva y cruce de botones) son algo más rápidos: 0,3 s (antes 0,45 s).

## [1.2.5] - 2026-10-28
- **«Paso a paso»: primero sube, luego aparece.** Al acertar, la operación que estaba se desplaza hacia arriba y se reduce; la operación nueva espera (invisible, ocupando ya su sitio) a que esa animación termine y entonces aparece con un fundido suave (0,45 s). **Los botones no desaparecen**: se quedan los viejos y, a la vez que sale la operación nueva, se funden con los nuevos. No se pueden pulsar —ni con el teclado— hasta que los nuevos se ven, y el tiempo para contestar (los puntos por velocidad) cuenta desde ese momento.

## [1.2.4] - 2026-10-28
- **Opciones: nada se redimensiona al cambiar de voz.** Los cuatro textos de ayuda de «Voz de las explicaciones» están siempre en la página, uno sobre otro, y solo se ve el que toca: el hueco es el del más largo, así que el alto no cambia entre Piper y Navegador (ni cuando sale el aviso de que no suena). El tamaño del panel se calcula a saltos de 0,02 para que diferencias de un píxel no lo muevan. En móvil ahora también se ve ese texto (antes se ocultaba y no se veía el aviso de que la voz no sonaba).
- **«Paso a paso»: los botones ya no cambian de sitio.** El espacio de todas las líneas del historial se reserva desde la primera pregunta (las que faltan, vacías y arriba), y la operación y los botones quedan fijos mientras se van llenando. El tamaño que hizo falta para la primera (la operación más larga) se mantiene en todas las preguntas de esa operación; por eso al principio los elementos son algo más pequeños en pantallas estrechas.

## [1.2.3] - 2026-10-28
- **«Paso a paso» con progresión visible**: al acertar un paso, la operación que se acaba de resolver se encoge y sube a un historial pequeño encima de la actual (en la misma animación entra la siguiente), y las que ya estaban suben un poco. Queda escrito como una cadena: `6 × 7 − 18 + 10` · `= 42 − 18 + 10` · `= 24 + 10 = ?`. Si se falla, la pregunta se repite sin mover nada.

## [1.2.2] - 2026-10-28
- **Consigna en voz alta**: la primera vez que sale cada tipo de pregunta en una partida se lee lo que se pide, una sola vez: «¿Qué operación hay que resolver primero?» (¿Cuál va primero?), «¿Qué operación vale lo mismo?» (Elige la igualdad), «¿Qué operación queda en cada paso?» (Paso a paso) y «Resuelve el primer paso y arrastra lo que queda» (Arrastrar). En «Todo junto» se dice cada una la primera vez que aparece. Respeta «Explicación con voz» (desactivada, no habla) y nunca espera a que cargue Piper; con Piper se sintetiza por adelantado al empezar la partida.

## [1.2.1] - 2026-10-28
- **Cinta de versión**: sobresalía por la esquina redondeada de la tarjeta del menú principal (pisaba el borde, sobre todo en móvil). Ahora se recorta por dentro del borde y con la esquina redondeada igual que la tarjeta.
- **Opciones con «Escala fija»**: al abrirlas, el contenido se reducía en dos pasos (uno al abrir y otro a los 0,35 s) y se notaba un «rebote» de tamaño. Ahora el tamaño se calcula una sola vez, a partir del alto natural del panel y antes de que termine de entrar, así que sale siempre igual y no se mueve.
- **Voz del navegador**
  - iPhone: Safari solo deja hablar si la primera locución se inicia dentro de un toque, y el juego la pedía tarde. Ahora se lanza una locución muda en el primer toque (esté o no activado ese motor) y otra al empezar cada «Probar»/explicación, y se reanuda la síntesis si estaba en pausa. Si el navegador no llega a reproducir una frase (2,5 s sin arrancar), la explicación sigue con los tiempos de lectura en vez de quedarse parada, y la nota de Opciones avisa de que no ha sonado.
  - Windows: la lista de voces se vuelve a leer cuando se necesita (algunos navegadores la rellenan tarde y no avisan) y también se aceptan voces cuyo idioma viene mal pero cuyo nombre dice «Spanish/Español». Si de verdad no hay voz en español, la nota explica cómo tenerla: Edge trae voces online, o añadir el español en Configuración → Hora e idioma → Idioma y región → Español → Voz.

## [1.2.0] - 2026-10-28
- **Tema visual nuevo: «Arcade galáctico»** (`web/tema.css`, pensado para 5.º). Espacio con estrellas que se desplazan, un planeta y una luna; paneles con contorno oscuro grueso y filo de luz; botones de arcade que se hunden al pulsar (verde para lo principal); los cuatro modos son cartas de colores (azul, rosa, naranja y verde); respuestas como teclas de arcade (se ponen verdes o rojas al contestar); título tipo pegatina; números en Fredoka (redondeada) y títulos en Lilita One. Los colores con significado (números, resultados, operaciones) no cambian. Solo toca el aspecto: quitando el `<link>` de `tema.css` en `index.html` vuelve el cuaderno cuadriculado.
- **Cuentas de cabeza en todos los niveles y actividades**: ningún número ni resultado pasa de 100, las multiplicaciones son de tablas (un factor de 10 o menos, producto hasta 100) y las divisiones son entre 10 o menos. Lo mismo vale para las respuestas malas, la bandeja de «Arrastrar» y los resultados que enseña la explicación (antes salían cosas como `17 × 200` o 3400).
- **Opciones**: con «Escala fija» grande o una ventana baja, el panel se cortaba por abajo. Ahora el contenido se reduce lo justo para que quepa entero (también al cambiar de voz, que cambia el texto de ayuda).
- **Elegir actividad**: «Todo junto» ocupa todo el ancho, así la cuadrícula de 5 actividades ya no queda coja (en ordenador y en móvil).

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
