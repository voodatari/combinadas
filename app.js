/**
 * Combinadas · navegación, partida, resultados y ranking local
 * Actividades: reconocer (¿cuál va primero?) · igualdad (elige la igualdad correcta) · pasos (paso a paso hasta la solución)
 *              · arrastrar (mueve las piezas) · mezcla (todas)
 * Modos: timeattack · sudden_death · survival · practice (con explicación de cada error; en los demás modos, si en Opciones
 *        «Explicar los fallos» está en «Siempre», el juego se pausa por completo —también el reloj— mientras se explica el fallo)
 * Todo es local: ranking, nombre y ajustes en localStorage (sin cuentas ni servidor).
 */
const app = {

    // --- ESTADO ---
    state: {
        playerName: '',
        mode: 'timeattack',
        actividad: 'reconocer',
        nivel: 1,                 // 1, 2, 3 · 0 = mixto
        tiempo: 60,               // contrarreloj
        score: 0, streak: 0, maxStreak: 0,
        total: 0, aciertos: 0, lives: 3,
        timeRemaining: 0, timerId: null,
        isPlaying: false, pausado: false,
        q: null,                  // pregunta en curso
        pasos: null,              // operación en curso en «Paso a paso» (sigue de pregunta en pregunta hasta la solución)
        recientes: [],            // últimas operaciones, para no repetir enseguida
        consignas: {},            // tipos de pregunta cuya consigna ya se ha dicho en esta partida
        falladas: [],             // operaciones falladas en la partida
        timeouts: [],
        lastRankingKey: null
    },

    TIPOS: {
        reconocer: { nombre: '¿Cuál va primero?', icono: '🔎', velocidad: [2500, 5000] },
        igualdad: { nombre: 'Elige la igualdad', icono: '⚖️', velocidad: [4000, 8000] },
        pasos: { nombre: 'Paso a paso', icono: '🪜', velocidad: [3500, 7000] },
        arrastrar: { nombre: 'Arrastrar', icono: '✋', velocidad: [8000, 15000] },
        mezcla: { nombre: 'Todo junto', icono: '🧩', velocidad: [4000, 8000] }
    },
    /* lo que se dice en voz alta la primera vez que aparece cada tipo de pregunta en una partida */
    CONSIGNAS: {
        reconocer: '¿Qué operación hay que resolver primero?',
        igualdad: '¿Qué operación vale lo mismo?',
        pasos: '¿Qué operación queda en cada paso?',
        arrastrar: 'Resuelve el primer paso y arrastra lo que queda.'
    },
    MODOS: { timeattack: 'CONTRARRELOJ', sudden_death: 'MUERTE SÚBITA', survival: 'SUPERVIVENCIA', practice: 'PRÁCTICA' },
    // Cuenta atrás 3-2-1 antes de empezar: desactivada (no hay modo con ranking compartido)
    CUENTA_ATRAS: false,
    ANONIMO: 'Anónimo',
    MULT_NIVEL: { 1: 1, 2: 1.5, 3: 2 },

    // --- ALMACENAMIENTO (todo local, sin cuentas) ---
    leer(k, def) { try { const v = localStorage.getItem('combinadas.' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    guardar(k, v) { try { localStorage.setItem('combinadas.' + k, JSON.stringify(v)); } catch (e) {} },

    later(fn, ms) { const id = setTimeout(fn, ms); this.state.timeouts.push(id); return id; },
    clearLater() { this.state.timeouts.forEach(clearTimeout); this.state.timeouts = []; },
    $(id) { return document.getElementById(id); },

    // --- NAVEGACIÓN ---
    showScreen(screenId, sinSonido) {
        if (!sinSonido) Sonido.efecto('click');
        document.body.classList.toggle('en-juego', screenId === 'screen-game');     // el botón de opciones no se ve durante la partida
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            setTimeout(() => { if (!s.classList.contains('active')) s.classList.add('hidden'); }, 400);
        });
        const target = this.$(screenId);
        target.classList.remove('hidden');
        setTimeout(() => target.classList.add('active'), 50);

        if (screenId === 'screen-home') this.seguirCinta(900);
        if (screenId === 'screen-ranking') this.abrirRanking();
        if (screenId === 'screen-config') this.pintarConfig();
        if (screenId !== 'screen-game') { this.ajustarPanel(screenId); setTimeout(() => this.ajustarPanel(screenId), 450); }
        if (['screen-home', 'screen-modes', 'screen-config'].includes(screenId)) Sonido.musica('menu');
        else if (screenId === 'screen-results' || screenId === 'screen-ranking') Sonido.musica('fin');
    },

    /* Ajusta el contenido de un panel al alto disponible (sin scroll) reduciéndolo un poco si hace falta */
    ajustarPanel(screenId) {
        const pantalla = this.$(screenId); if (!pantalla) return;
        const panel = pantalla.querySelector('.glass-panel'); if (!panel) return;
        // el contenido (o, si no hay un contenedor, cada hijo del panel) se reduce hasta que todo cabe: en ninguna pantalla debe aparecer scroll.
        // Siempre se empieza desde el tamaño normal y se baja a saltos de 0,02 (con un escalón más de margen): el mismo contenido da siempre el mismo
        // tamaño, así que repetir el ajuste no cambia nada (nada «rebota»)
        const cont = pantalla.querySelector('.panel-contenido'), objetivos = cont ? [cont] : [...panel.children];
        const poner = z => objetivos.forEach(e => { e.style.zoom = z; });
        const cabe = k => { poner((k / 50).toFixed(2)); return panel.scrollHeight <= panel.clientHeight + 1; };
        let bajo = 20, alto = 50;                                              // búsqueda binaria del mayor k (zoom = k/50) con el que cabe: pocas medidas, mismo resultado siempre
        if (!cabe(50)) { while (bajo < alto) { const medio = Math.ceil((bajo + alto) / 2); if (cabe(medio)) bajo = medio; else alto = medio - 1; } poner(Math.max(20, bajo - 1) / 50); }
    },

    // --- INICIALIZACIÓN ---
    init() {
        const nameInput = this.$('player-name'), btnStart = this.$('btn-start');
        const guardado = this.leer('nombre', '');
        if (guardado) { nameInput.value = guardado; this.state.playerName = guardado; }

        const cfg = this.leer('config', {});
        if (this.TIPOS[cfg.actividad]) this.state.actividad = cfg.actividad;
        if ([0, 1, 2, 3].includes(cfg.nivel)) this.state.nivel = cfg.nivel;
        if ([30, 60, 90, 120].includes(cfg.tiempo)) this.state.tiempo = cfg.tiempo;

        nameInput.addEventListener('input', e => { this.state.playerName = e.target.value.trim(); });
        const empezar = () => {
            // sin nombre se juega como «Anónimo» (y no se guarda: la próxima vez el campo sale vacío)
            const nombre = nameInput.value.trim();
            this.state.playerName = nombre || this.ANONIMO;
            this.guardar('nombre', nombre);
            this.showScreen('screen-modes');
        };
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { nameInput.blur(); empezar(); } });
        btnStart.addEventListener('click', empezar);

        document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => this.showScreen(b.dataset.go)));

        document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
            this.state.mode = card.dataset.mode;
            this.showScreen('screen-config');
        }));
        document.querySelectorAll('.activity-card').forEach(card => card.addEventListener('click', () => {
            Sonido.efecto('click');
            this.state.actividad = card.dataset.actividad;
            this.pintarConfig();
        }));
        this.$('level-seg').addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            Sonido.efecto('click');
            this.state.nivel = parseInt(b.dataset.nivel, 10);
            this.pintarConfig();
            this.ajustarPanel('screen-config');
        });
        this.$('time-seg').addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            Sonido.efecto('click');
            this.state.tiempo = parseInt(b.dataset.tiempo, 10);
            this.pintarConfig();
        });
        this.$('btn-play').addEventListener('click', () => {
            this.guardar('config', { actividad: this.state.actividad, nivel: this.state.nivel, tiempo: this.state.tiempo });
            this.startGame();
        });

        this.$('btn-abort').addEventListener('click', () => this.abortar());
        this.$('btn-retry').addEventListener('click', () => { Sonido.efecto('click'); this.startGame(); });
        this.$('btn-otra-actividad').addEventListener('click', () => this.showScreen('screen-config'));   // el mismo modo, otra actividad / nivel
        this.$('btn-change-name').addEventListener('click', () => this.abrirCambioNombre());
        this.$('btn-name-cancel').addEventListener('click', () => { Sonido.efecto('click'); cerrarModal(this.$('modal-change-name')); });
        this.$('btn-name-ok').addEventListener('click', () => this.confirmarNombre());
        this.$('new-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') this.confirmarNombre(); });

        this.$('ranking-mode-select').addEventListener('change', () => this.renderRanking());
        this.$('ranking-activity-select').addEventListener('change', () => this.renderRanking());

        window.addEventListener('resize', () => {
            this._escPasos = null; this._kxPasos = null;
            this.ajustarTablero();
            ['screen-home', 'screen-modes', 'screen-config', 'screen-results', 'screen-ranking'].forEach(id => { if (this.$(id).classList.contains('active')) this.ajustarPanel(id); });
            this.posicionarCinta();
        });
        if (document.fonts) document.fonts.addEventListener('loadingdone', () => this.ajustarTablero());
        document.addEventListener('keydown', e => this.teclado(e));
        if (window.ResizeObserver) { const pp = document.querySelector('#screen-home .glass-panel'); if (pp) new ResizeObserver(() => this.posicionarCinta()).observe(pp); }
        this.seguirCinta(900);
        this.pintarConfig();
    },

    /* la cinta «v1.0» se coloca sobre la esquina superior derecha de la tarjeta del menú principal */
    posicionarCinta() {
        const sec = this.$('screen-home'), c = sec && sec.querySelector('.cinta-version'), p = sec && sec.querySelector('.glass-panel');
        if (!c || !p) return;
        // medidas de maquetación (offset*), no getBoundingClientRect: la pantalla entra con un scale() y la cinta, que está dentro, ya se escala con ella
        let x = 0, y = 0, el = p;
        while (el && el !== sec) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
        // por dentro del borde de la tarjeta (clientLeft/clientTop = grosor del borde), con la esquina redondeada un poco menos
        const radio = Math.max(0, parseFloat(getComputedStyle(p).borderTopRightRadius) - p.clientLeft);
        Object.assign(c.style, { left: (x + p.clientLeft) + 'px', top: (y + p.clientTop) + 'px', width: p.clientWidth + 'px', height: p.clientHeight + 'px',
            borderRadius: radio + 'px' });
    },
    /* mientras la tarjeta entra con su animación, la cinta la sigue en cada fotograma (si no, se ve un momento fuera de su sitio) */
    seguirCinta(ms) {
        const fin = performance.now() + ms;
        const paso = () => { this.posicionarCinta(); if (performance.now() < fin) requestAnimationFrame(paso); };
        paso();
    },

    pintarConfig() {
        const s = this.state;
        document.querySelectorAll('.activity-card').forEach(c => c.classList.toggle('selected', c.dataset.actividad === s.actividad));
        document.querySelectorAll('#level-seg button').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.nivel, 10) === s.nivel));
        document.querySelectorAll('#time-seg button').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.tiempo, 10) === s.tiempo));
        this.$('time-row').style.display = s.mode === 'timeattack' ? '' : 'none';
        // todas las explicaciones de nivel están en la página, una sobre otra, y solo se ve la que toca: el hueco es el de la más larga y no cambia el tamaño al elegir nivel
        this.$('level-hint').querySelectorAll('span').forEach(e => e.classList.toggle('ver', e.dataset.v === String(s.nivel)));
        this.$('config-title').textContent = this.MODOS[s.mode].charAt(0) + this.MODOS[s.mode].slice(1).toLowerCase() + ' · ¿qué quieres practicar?';
    },

    abrirCambioNombre() {
        Sonido.efecto('click');
        const input = this.$('new-player-name');
        input.value = this.state.playerName === this.ANONIMO ? '' : this.state.playerName;
        abrirModal(this.$('modal-change-name'));
        input.focus();
    },
    confirmarNombre() {
        Sonido.efecto('click');
        const val = this.$('new-player-name').value.trim();
        this.state.playerName = val || this.ANONIMO;       // vacío: «Anónimo»
        this.guardar('nombre', val);
        this.$('player-name').value = val;
        this.$('btn-start').disabled = false;
        cerrarModal(this.$('modal-change-name'));
    },

    // --- OPERACIONES ---
    /* Todas las formas (pri, izq, parIzq, parDer) valen para todas las actividades: el nivel decide cuáles salen */
    nuevaOperacion(tipo) {
        const s = this.state;
        const nivel = s.nivel || Op.elegir([1, 2, 3]);
        let op = null;
        for (let i = 0; i < 14; i++) {
            op = Op.generar(nivel);
            if (!s.recientes.includes(op.clave)) break;
        }
        s.recientes.push(op.clave);
        if (s.recientes.length > 40) s.recientes.shift();
        return op;
    },

    /* «Paso a paso»: la misma operación sigue de pregunta en pregunta (estado k = tras k pasos; en el último solo queda decir cuánto vale) hasta la solución */
    preguntaPasos() {
        const s = this.state;
        if (!s.pasos || s.pasos.fin) s.pasos = { op: this.nuevaOperacion('pasos'), estado: 0, fin: false };
        return { op: s.pasos.op, estado: s.pasos.estado };
    },
    avanzarPasos(q) {
        const s = this.state;
        if (!s.pasos || s.pasos.op !== q.op) return;
        if (q.estado < q.op.n - 1) s.pasos.estado = q.estado + 1; else s.pasos.fin = true;
    },

    // --- PARTIDA ---
    startGame() {
        const s = this.state;
        this.clearLater();
        clearInterval(s.timerId);
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        Object.assign(s, { score: 0, streak: 0, maxStreak: 0, total: 0, aciertos: 0, lives: 3, q: null, pasos: null, falladas: [], recientes: [], consignas: {}, isPlaying: false, pausado: false });
        Voz.parar();
        if (VozUI.explicacion() && Voz.estado() === 'lista') Voz.precargar((s.actividad === 'mezcla' ? ['reconocer', 'igualdad', 'pasos', 'arrastrar'] : [s.actividad]).map(t => this.CONSIGNAS[t]));   // la voz de Piper tarda un poco en sintetizar
        updateStreak(0);
        this.$('hud-score').textContent = '0';
        this.$('question-area').innerHTML = '';
        this.$('question-text').innerHTML = '';
        this.$('step-indicator').innerHTML = '';
        this.$('answer-note').innerHTML = '';
        document.querySelector('.game-board').classList.remove('shake');      // nada de la partida anterior (sacudida de fallo) se arrastra a la nueva
        this.$('feedback-overlay').className = 'feedback-fx';

        const hudTimer = this.$('hud-time-container'), hudLives = this.$('hud-lives-container'), hudScore = this.$('hud-score-container');
        this.$('hud-time').classList.remove('danger');
        hudScore.classList.remove('centered');
        hudTimer.classList.remove('hidden');
        hudLives.classList.add('hidden');
        this.$('hud-time-label').textContent = 'TIEMPO';

        this.$('current-mode-name').textContent = this.MODOS[s.mode];
        this.$('current-activity-name').textContent = this.TIPOS[s.actividad].nombre.toUpperCase();
        this.$('btn-abort').textContent = s.mode === 'practice' ? '🏁 Terminar' : '✖ Abortar';

        if (s.mode === 'timeattack') {
            s.timeRemaining = s.tiempo;
        } else if (s.mode === 'sudden_death') {
            hudTimer.classList.add('hidden');
            hudScore.classList.add('centered');
        } else if (s.mode === 'survival') {
            hudLives.classList.remove('hidden');
            this.$('hud-time-label').textContent = 'RELOJ';
            s.timeRemaining = 20;
            this.pintarVidas();
        } else {   // práctica: reloj que sube
            s.timeRemaining = 0;
        }
        this.pintarTiempo();

        this.showScreen('screen-game', true);
        Sonido.musica(s.mode, true);   // cada partida empieza su música desde el principio

        const comenzar = () => {
            s.isPlaying = true;
            if (s.mode !== 'sudden_death') this.iniciarReloj();
            this.siguientePregunta();
        };
        if (s.mode === 'practice' || !this.CUENTA_ATRAS) {
            if (s.mode !== 'practice') Sonido.efecto('start');
            comenzar();
        } else {
            Sonido.efecto('start');
            showCountdown(comenzar, '<div class="countdown-header">' + this.MODOS[s.mode] + ' · ' + this.TIPOS[s.actividad].nombre + '</div>');
        }
    },

    async abortar() {
        const s = this.state;
        Sonido.efecto('click');
        if (s.mode === 'practice' && s.isPlaying) { this.endGame(); return; }
        if (s.isPlaying) {
            const ok = await confirmDialog('Se perderá esta partida.', { title: '¿Abandonar?', icon: '🚪', okText: 'Abandonar', cancelText: 'Seguir jugando', danger: true });
            if (!ok || !s.isPlaying) return;
        }
        s.isPlaying = false;
        Voz.parar();
        clearInterval(s.timerId);
        this.clearLater();
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        this.showScreen('screen-home');
    },

    iniciarReloj() {
        const s = this.state;
        clearInterval(s.timerId);
        s.timerId = setInterval(() => {
            if (!s.isPlaying || s.pausado) return;          // pausado: mientras se explica un fallo
            if (s.mode === 'practice') s.timeRemaining++;
            else s.timeRemaining--;
            this.pintarTiempo();
            const hudTime = this.$('hud-time');
            const peligro = (s.mode === 'timeattack' && s.timeRemaining <= 10) || (s.mode === 'survival' && s.timeRemaining <= 5);
            hudTime.classList.toggle('danger', peligro);
            if (peligro && s.timeRemaining > 0) Sonido.efecto('click', 0.25);

            if (s.mode !== 'practice' && s.timeRemaining <= 0) {
                if (s.mode === 'survival') this.tiempoAgotadoPregunta();
                else this.endGame();
            }
        }, 1000);
    },

    pintarTiempo() {
        const t = Math.max(0, this.state.timeRemaining);
        this.$('hud-time').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    },
    pintarVidas() { this.$('hud-lives').textContent = '❤️'.repeat(Math.max(0, this.state.lives)) || '💔'; },

    // --- PREGUNTAS ---
    siguientePregunta() {
        const s = this.state;
        if (!s.isPlaying) return;
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        const tipo = s.actividad === 'mezcla' ? Op.elegir(['reconocer', 'igualdad', 'pasos', 'arrastrar']) : s.actividad;
        let op, extra = {};
        if (tipo === 'pasos') { const p = this.preguntaPasos(); op = p.op; extra.estado = p.estado; }
        else op = this.nuevaOperacion(tipo);
        const q = Object.assign({ tipo, op, nivel: op.nivel, resuelta: false, inicio: Date.now() }, extra);
        if (tipo === 'reconocer') q.opciones = Op.opcionesPrimero(op);
        if (tipo === 'igualdad') q.opciones = Op.opcionesIgualdad(op);
        if (tipo === 'pasos') q.opciones = Op.opcionesPasos(op, q.estado);
        if (tipo === 'arrastrar') q.plantilla = Op.plantillaArrastre(op);
        s.q = q;
        if (s.mode === 'survival') {
            s.timeRemaining = Math.max(8, 20 - Math.floor(s.aciertos / 5));
            this.pintarTiempo();
            this.$('hud-time').classList.remove('danger');
        }
        this.$('answer-note').innerHTML = '';
        this.pintarPregunta();
    },

    /* la operación como fichas (mismas clases que en la explicación) */
    exprHTML(tokens) { return tokens.map(t => '<span class="tk tk-' + t.k + '">' + esc(t.v) + '</span>').join(''); },

    pintarPregunta() {
        const q = this.state.q, op = q.op, area = this.$('question-area'), texto = this.$('question-text');
        let pasosPrev = null;
        area.classList.remove('bloqueado');
        const ind = this.$('step-indicator');
        ind.innerHTML = (this.state.actividad === 'mezcla' ? this.TIPOS[q.tipo].icono + ' ' + this.TIPOS[q.tipo].nombre : '') +
            (q.tipo === 'pasos' ? (this.state.actividad === 'mezcla' ? ' · ' : '') + 'paso ' + (q.estado + 1) + ' de ' + op.n : '');

        if (q.tipo === 'reconocer') {
            texto.innerHTML = '¿Qué operación hay que resolver <b>primero</b>?';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '</div><div class="options-grid tres">' +
                q.opciones.map((o, i) => '<button type="button" class="option-btn" data-i="' + i + '"><span class="expr">' + esc(o.texto) + '</span></button>').join('') + '</div>';
        } else if (q.tipo === 'igualdad') {
            texto.innerHTML = '<b>Operaciones combinadas</b>: ¿qué operación vale lo mismo?';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '<span class="igual">=</span><span class="interr">?</span></div><div class="options-grid">' +
                q.opciones.map((o, i) => '<button type="button" class="option-btn" data-i="' + i + '"><span class="expr">' + esc(o.texto) + '</span></button>').join('') + '</div>';
        } else if (q.tipo === 'pasos') {
            const ultimo = q.estado === op.n - 1;
            texto.innerHTML = ultimo ? '<b>Último paso</b>: ¿cuánto vale la operación?' : q.estado === 0 ? '<b>Resuelve el primer paso</b>: ¿cómo queda la operación?' : '<b>Resuelve el siguiente paso</b>: ¿cómo queda la operación?';
            // los pasos ya resueltos quedan arriba, pequeños, para que se vea la progresión. El sitio de TODAS las líneas está reservado desde
            // la primera pregunta (las que faltan, vacías y arriba), así la operación y los botones no cambian de sitio al ir apareciendo
            const huecos = op.n - 1, previos = [];
            for (let h = 0; h < huecos; h++) {
                const k = h - (huecos - q.estado);          // paso que va en este sitio: los más recientes, abajo
                previos.push(k >= 0 ? '<div class="hist-linea">' + (k ? '<span class="igual">=</span>' : '') + this.exprHTML(Op.antes(op, k)) + '</div>' : '<div class="hist-linea vacia">&nbsp;</div>');
            }
            pasosPrev = this.capturarPasos(area, op, q.estado);
            if (pasosPrev) { pasosPrev.botones = area.querySelector('.options-grid'); if (pasosPrev.botones) pasosPrev.botones.remove(); }     // los botones viejos se quedan hasta el fundido
            area.innerHTML = '<div class="historial">' + previos.join('') + '</div>' +
                '<div class="expr-grande">' + (q.estado ? '<span class="igual">=</span>' : '') + this.exprHTML(Op.antes(op, q.estado)) + '<span class="igual">=</span><span class="interr">?</span></div><div class="options-grid' + (ultimo ? ' tres' : '') + '">' +
                q.opciones.map((o, i) => '<button type="button" class="option-btn" data-i="' + i + '"><span class="expr">' + esc(o.texto) + '</span></button>').join('') + '</div>';
        } else {
            texto.innerHTML = '<b>Monta el siguiente paso</b>: resuelve el primer paso y arrastra lo que queda';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '</div>';
            this.arrastre = Arrastre.montar(area, op, q.plantilla);
            area.querySelector('[data-acc="borrar"]').addEventListener('click', () => { Sonido.efecto('click'); this.arrastre.borrar(); });
            area.querySelector('[data-acc="comprobar"]').addEventListener('click', () => this.comprobarArrastre());
        }
        if (q.tipo !== 'arrastrar') area.querySelectorAll('.option-btn').forEach(b => b.addEventListener('click', () => this.responder(parseInt(b.dataset.i, 10), b)));
        this.$('answer-note').className = 'answer-note' + (q.tipo === 'pasos' ? ' pasos' : '');
        this.decirConsigna(q.tipo);
        this.ajustarTablero();
        if (q.tipo === 'pasos') {
            area.dataset.pasosOp = op.clave; area.dataset.pasosEstado = q.estado;
            const fin = this.animarPasos(area, pasosPrev);
            if (fin) {
                // La operación nueva no aparece hasta que la anterior ha terminado de subir. Los botones NO desaparecen: los viejos se quedan en su sitio
                // hasta que se voltean.
                const expr = area.querySelector('.expr-grande'), grid = area.querySelector('.options-grid'), viejos = pasosPrev.botones;
                expr.classList.add('espera'); grid.classList.add('espera');
                if (viejos) {
                    area.style.position = 'relative';
                    Object.assign(viejos.style, { position: 'absolute', left: grid.offsetLeft + 'px', top: grid.offsetTop + 'px', width: grid.offsetWidth + 'px', height: grid.offsetHeight + 'px', margin: '0' });
                    viejos.classList.add('bloqueado');
                    area.appendChild(viejos);
                }
                /* Tarjetas que se voltean (eje horizontal): cada botón viejo gira hasta quedar de canto y, por la otra cara, sale el nuevo; la operación
                   nueva también se voltea. Empieza cuando la anterior ha terminado de subir. */
                // Botones: cada tarjeta gira (media vuelta para irse, media para que salga la nueva) y van una detrás de otra, de izquierda
                // a derecha: la siguiente empieza cuando la anterior va por la mitad de su vuelta. La operación se voltea sobre el eje horizontal.
                const MEDIO = 115, ESCALON = MEDIO;      // media vuelta = 115 ms (la vuelta entera de una tarjeta, 230); la siguiente empieza cuando la anterior va por la mitad
                const voltear = (el, eje, desde, hasta, retardo) => el.animate(
                    [{ transform: 'perspective(700px) rotate' + eje + '(' + desde + 'deg)' }, { transform: 'perspective(700px) rotate' + eje + '(' + hasta + 'deg)' }],
                    { duration: MEDIO, delay: retardo, easing: desde ? 'ease-out' : 'ease-in', fill: desde ? 'backwards' : 'both' });    // los nuevos acaban sin transform (el hover sigue funcionando)
                const revelar = () => {
                    if (this.state.q !== q) { if (viejos) viejos.remove(); return; }
                    // botones en una sola columna (móvil en vertical): giran sobre el eje horizontal, de abajo arriba, y siguen el mismo orden (de arriba a abajo);
                    // en fila (ordenador, móvil apaisado): sobre el eje vertical, de izquierda a derecha
                    const eje = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length === 1 ? 'X' : 'Y';
                    expr.classList.remove('espera'); grid.classList.remove('espera');
                    expr.style.animation = 'none';
                    const nuevos = [...grid.querySelectorAll('.option-btn')];
                    q.inicio = Date.now() + 2 * MEDIO + (nuevos.length - 1) * ESCALON;      // el tiempo para contestar cuenta desde que se ven los botones nuevos
                    if (!expr.animate) { if (viejos) viejos.remove(); return; }
                    voltear(expr, 'X', -90, 0, MEDIO);
                    nuevos.forEach((b, i) => voltear(b, eje, 90, 0, i * ESCALON + MEDIO));
                    if (viejos) {
                        const fin2 = [...viejos.querySelectorAll('.option-btn')].map((b, i) => voltear(b, eje, 0, -90, i * ESCALON).finished);
                        Promise.all(fin2).then(() => viejos.remove(), () => viejos.remove());
                    }
                };
                fin.then(revelar, revelar);
            }
        }
        else { delete area.dataset.pasosOp; delete area.dataset.pasosEstado; }
        requestAnimationFrame(() => this.ajustarTablero());
    },

    /* La primera vez que sale cada tipo de pregunta en la partida se lee la consigna una sola vez (si la voz está activada y lista: nunca se espera a que cargue) */
    decirConsigna(tipo) {
        const s = this.state;
        if (s.consignas[tipo] || !this.CONSIGNAS[tipo] || !VozUI.explicacion() || Voz.estado() !== 'lista') return;
        s.consignas[tipo] = true;
        Voz.decir(this.CONSIGNAS[tipo]);
    },

    /* «Paso a paso»: si esta pregunta es el paso siguiente de la anterior (se acaba de acertar), guarda dónde estaban en pantalla la operación grande
       y las líneas del historial para poder moverlas (técnica FLIP) */
    capturarPasos(area, op, estado) {
        if (area.dataset.pasosOp !== op.clave || Number(area.dataset.pasosEstado) + 1 !== estado) return null;
        const grande = area.querySelector('.expr-grande');
        if (!grande) return null;
        // la parte que de verdad se va al historial: la operación sin el «= ?» del final
        const gr = grande.getBoundingClientRect(), iguales = grande.querySelectorAll('.igual'), ult = iguales.length ? iguales[iguales.length - 1].getBoundingClientRect() : gr;
        return { grande: { left: gr.left, top: gr.top, height: gr.height, width: ult.left - gr.left }, hist: [...area.querySelectorAll('.hist-linea:not(.vacia)')].map(e => e.getBoundingClientRect()) };
    },
    /* La operación que se acaba de resolver se encoge y sube a su sitio en el historial, y las que ya estaban suben un poco, a la vez que aparece la siguiente */
    animarPasos(area, prev) {
        if (!prev || !area.animate) return null;
        const animaciones = [];
        [...area.querySelectorAll('.hist-linea:not(.vacia)')].forEach((el, i) => {
            const nueva = el.getBoundingClientRect(), vieja = i < prev.hist.length ? prev.hist[i] : prev.grande, desdeGrande = i >= prev.hist.length;
            if (!nueva.height) return;
            let resto = null;
            if (desdeGrande) {      // el «= ?» (que ya no forma parte de la línea) viaja con ella, fuera del flujo, y se desvanece cuando está en su sitio
                el.insertAdjacentHTML('beforeend', '<span class="resto"><span class="igual">=</span><span class="interr">?</span></span>');
                resto = el.lastElementChild;
            }
            const dx = vieja.left + vieja.width / 2 - (nueva.left + nueva.width / 2), dy = vieja.top + vieja.height / 2 - (nueva.top + nueva.height / 2);
            const esc = desdeGrande ? Math.min(4, vieja.height / nueva.height) : 1;
            animaciones.push(el.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + esc + ')', color: desdeGrande ? '#ffffff' : getComputedStyle(el).color, opacity: desdeGrande ? 1 : 0.8 },
                { transform: 'none', color: getComputedStyle(el).color, opacity: 0.8 }
            ], { duration: 640, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' }));
        });
        const fin = animaciones.length ? Promise.all(animaciones.map(a => a.finished)) : null;
        if (fin) fin.then(() => area.querySelectorAll('.hist-linea .resto').forEach(r => {
            const a = r.animate && r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 128, easing: 'ease-out', fill: 'forwards' });
            if (a) a.onfinish = () => r.remove(); else r.remove();
        }), () => {});
        return fin;
    },

    /* Si el tablero no cabe (móvil bajo, ventana pequeña), todo lo de dentro (en «em») se reduce a la vez */
    ajustarTablero() {
        const b = document.querySelector('.game-board'); if (!b || !this.$('screen-game').classList.contains('active') && !this.state.isPlaying) return;
        /* «Paso a paso»: la operación empieza siendo la más larga; el tamaño que le hizo falta se mantiene en todas sus preguntas (si no, todo cambiaría de tamaño y de sitio al ir acortándose) */
        const q = this.state.q, pasos = q && q.tipo === 'pasos' && this._escPasos && this._escPasos.clave === q.op.clave;
        let esc = pasos ? this._escPasos.esc : 1;
        b.style.setProperty('--esc', esc.toFixed(2));
        /* Si la operación (o la plantilla de arrastrar) es muy ancha, se reduce SOLO ella (con un margen a cada lado) y no todo el tablero:
           así el texto de la pregunta y los botones conservan su tamaño. En «Paso a paso» se mantiene el mismo tamaño en toda la operación. */
        const rg = document.createRange();
        const ajustarAncho = () => b.querySelectorAll('.expr-grande, .plantilla').forEach(el => {
            const cs = getComputedStyle(b), ancho = (b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.94;
            let k = pasos && this._kxPasos && this._kxPasos.clave === q.op.clave ? this._kxPasos.k : 1;
            el.style.setProperty('--kx', k.toFixed(3));
            for (let n = 0; n < 40; n++) {
                rg.selectNodeContents(el);
                if (rg.getBoundingClientRect().width <= ancho || k < 0.3) break;
                k *= 0.96; el.style.setProperty('--kx', k.toFixed(3));
            }
            if (q && q.tipo === 'pasos' && el.classList.contains('expr-grande')) this._kxPasos = { clave: q.op.clave, k };
        });
        // se mide con rectángulos reales (Range): con el contenido centrado, scrollWidth no avisa del desborde por la izquierda
        const rango = document.createRange();
        const desborda = e => {
            rango.selectNodeContents(e);
            const c = rango.getBoundingClientRect(), r = e.getBoundingClientRect(), t = b.getBoundingClientRect(), cs = getComputedStyle(b);
            const izq = t.left + parseFloat(cs.paddingLeft) - 1, der = t.right - parseFloat(cs.paddingRight) + 1;      // dentro del relleno del tablero
            return c.width > 0 && (c.width > r.width + 1 || c.left < izq || c.right > der);
        };
        const noCabe = () => b.scrollHeight > b.clientHeight + 1 || [...b.querySelectorAll('.bandeja, .option-btn, .answer-note')].some(desborda);
        /* el texto de los botones nunca más grande que el de la operación que se pregunta */
        const ajustarBotones = () => {
            b.style.setProperty('--kb', '1');
            const grande = b.querySelector('.expr-grande'), boton = b.querySelector('.option-btn .expr');
            if (!grande || !boton) return;
            const fg = parseFloat(getComputedStyle(grande).fontSize), fb = parseFloat(getComputedStyle(boton).fontSize);
            if (fb > fg) b.style.setProperty('--kb', (fg / fb).toFixed(3));
        };
        ajustarAncho(); ajustarBotones();
        for (let n = 0; n < 16 && noCabe() && esc > 0.5; n++) { esc -= 0.04; b.style.setProperty('--esc', esc.toFixed(2)); ajustarAncho(); ajustarBotones(); }
        if (q && q.tipo === 'pasos') this._escPasos = { clave: q.op.clave, esc };
    },

    comprobarArrastre() {
        const q = this.state.q;
        if (!q || q.resuelta || !this.arrastre) return;
        if (!this.arrastre.lleno()) { Sonido.efecto('click', 0.5); this.arrastre.pedirHuecos(); return; }
        this.responder(this.arrastre.valores(), null);
    },

    teclado(e) {
        const q = this.state.q;
        if (!this.state.isPlaying || !q || q.resuelta || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!this.$('screen-game').classList.contains('active') || this.state.pausado || this.$('question-area').querySelector('.espera')) return;
        if (q.tipo === 'arrastrar') { if (e.key === 'Enter') { e.preventDefault(); this.comprobarArrastre(); } return; }
        const n = parseInt(e.key, 10);
        if (!n || n > 3) return;
        const b = this.$('question-area').querySelectorAll('.option-btn')[n - 1];
        if (b) b.click();
    },

    // --- RESPUESTAS ---
    evaluar(q, valor) {
        if (q.tipo === 'arrastrar') return Op.comprobarArrastre(q.op, valor);
        return !!q.opciones[valor].ok;
    },

    notaRespuesta(q, ok) { return (ok ? '¡Bien! ' : '') + Op.nota(q.op); },

    marcarCorrecto(q, valor, boton) {
        const area = this.$('question-area');
        area.classList.add('bloqueado');
        const ok = this.evaluar(q, valor);
        if (q.tipo !== 'arrastrar') {
            area.querySelectorAll('.option-btn').forEach(b => { if (q.opciones[parseInt(b.dataset.i, 10)].ok) b.classList.add('correct'); });
            if (!ok && boton) boton.classList.add('wrong');
        } else {
            this.arrastre.marcar(ok);
            area.querySelectorAll('.acciones-arrastre button').forEach(b => b.disabled = true);
        }
        return ok;
    },

    /* lo que eligió el alumno, tal como lo necesita la explicación */
    elegidaParaExplicar(q, valor) {
        if (q.tipo === 'arrastrar') return Op.fichasArrastre(q.op, valor);
        return q.opciones[valor].tokens;
    },
    /* los datos de la explicación: en «Paso a paso» se explica la operación tal como estaba en esa pregunta (ya con los pasos anteriores hechos) */
    datosExplicacion(q, valor) {
        return { tipo: q.tipo, q: q.tipo === 'pasos' ? Op.desde(q.op, q.estado) : q.op, elegida: this.elegidaParaExplicar(q, valor), opcion: q.opciones && q.opciones[valor] };
    },

    async responder(valor, boton) {
        const s = this.state, q = s.q;
        if (!s.isPlaying || !q || q.resuelta) return;
        q.resuelta = true;
        if (boton) boton.blur();

        const ok = this.marcarCorrecto(q, valor, boton);
        const dt = Date.now() - q.inicio;
        s.total++;
        if (ok && q.tipo === 'pasos') this.avanzarPasos(q);       // resuelto un paso: el siguiente pregunta sigue con la misma operación
        const sigueOperacion = ok && q.tipo === 'pasos' && !s.pasos.fin;       // acierta un paso y la misma operación continúa: la animación empieza ya
        this.$('answer-note').innerHTML = sigueOperacion ? '' : this.notaRespuesta(q, ok);

        if (ok) {
            s.aciertos++;
            s.streak++;
            if (s.streak > s.maxStreak) s.maxStreak = s.streak;
            this.feedback(true);
            let extra = 0;
            if (s.mode !== 'practice') {
                const [t0, t1] = this.TIPOS[q.tipo].velocidad;
                if (dt < t0) { extra = 20; this.popup('¡Velocidad luz!', 'super'); }
                else if (dt < t1) { extra = 10; this.popup('¡Qué rápido!', 'high'); }
            }
            const puntos = Math.round((10 + extra + Math.min(s.streak, 15) * 2) * (this.MULT_NIVEL[q.nivel] || 1));
            s.score += puntos;
            this.$('hud-score').textContent = s.score;
            floatText('+' + puntos, this.$('hud-score'), 'float-good');
            updateStreak(s.streak);
            this.later(() => this.siguientePregunta(), sigueOperacion ? 0 : q.tipo === 'pasos' ? 640 : 800);      // «Paso a paso»: al acertar un paso empieza la animación en el acto
            return;
        }

        // --- fallo ---
        s.streak = 0;
        updateStreak(0);
        if (!s.falladas.includes(q.op.clave)) s.falladas.push(q.op.clave);
        this.feedback(false);

        if (s.mode === 'survival') { s.lives--; this.pintarVidas(); }
        const terminada = s.mode === 'sudden_death' || (s.mode === 'survival' && s.lives <= 0);
        if (VozUI.explicarEn(s.mode)) {
            // explicación: el juego (y el reloj) se detiene por completo hasta que se cierra
            s.pausado = true;
            // si este fallo termina la partida (muerte súbita, o última vida en supervivencia), ya suena la música de fin
            if (terminada) Sonido.musica('fin');
            const datos = this.datosExplicacion(q, valor);
            const animada = VozUI.explicacion();
            if (animada) Infografia.preparar(datos);      // empieza a sintetizar la narración mientras se ve la respuesta correcta
            await new Promise(r => this.later(r, 900));
            if (!s.isPlaying) return;
            await (animada ? Infografia.mostrar(datos) : Explicacion.mostrar(datos));
            s.pausado = false;
            if (!s.isPlaying) return;
            if (terminada) { this.endGame(); return; }
            this.siguientePregunta();
        } else if (VozUI.respuestaEn(s.mode)) {      // sin explicación: ventana con la respuesta correcta (el juego y el reloj se paran)
            if (terminada) Sonido.musica('fin');
            await this.mostrarRespuesta(q);
            if (!s.isPlaying) return;
            if (terminada) { this.endGame(); return; }
            this.siguientePregunta();
        } else if (s.mode === 'practice') {      // práctica sin explicaciones
            this.later(() => this.siguientePregunta(), 1800);
        } else if (s.mode === 'sudden_death') {
            this.later(() => this.endGame(), 2000);
        } else if (s.mode === 'survival') {
            if (s.lives <= 0) this.later(() => this.endGame(), 2000);
            else this.later(() => this.siguientePregunta(), 1800);
        } else {   // contrarreloj
            this.later(() => this.siguientePregunta(), 1500);
        }
    },

    /* Ventana con la respuesta correcta tras un fallo (cuando no se explica). El juego y el reloj están parados mientras está abierta;
       se cierra con el botón, Intro, espacio o Escape. Devuelve una promesa que se cumple al cerrarla. */
    mostrarRespuesta(q, titulo) {
        const s = this.state, op = q.op;
        s.pausado = true;
        return new Promise(resolve => {
            const previo = document.activeElement;
            const velo = document.createElement('div');
            velo.className = 'dialog-overlay resp-overlay';
            velo.innerHTML = '<div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="resp-titulo">' +
                '<div class="dialog-icon">💡</div>' +
                '<h3 id="resp-titulo" class="dialog-title">' + (titulo || 'La respuesta correcta') + '</h3>' +
                '<div class="resp-expr">' + esc(Op.texto(op.tokens)) + '</div>' +
                '<p class="dialog-message">' + this.notaRespuesta(q, false) + '</p>' +
                '<div class="dialog-actions"><button type="button" class="btn-primary resp-ok">¡Entendido! Siguiente ➜</button></div>' +
                '</div>';
            document.body.appendChild(velo);
            let cerrado = false;
            const cerrar = () => {
                if (cerrado) return;
                cerrado = true;
                document.removeEventListener('keydown', onKey, true);
                Sonido.efecto('click');
                velo.classList.add('dialog-out');
                setTimeout(() => velo.remove(), 200);
                if (previo && typeof previo.focus === 'function') previo.focus();
                s.pausado = false;
                resolve();
            };
            const onKey = ev => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); cerrar(); } };
            document.addEventListener('keydown', onKey, true);
            velo.querySelector('.resp-ok').addEventListener('click', cerrar);
            setTimeout(() => { const bt = velo.querySelector('.resp-ok'); if (bt && !cerrado) bt.focus({ preventScroll: true }); }, 50);
        });
    },

    tiempoAgotadoPregunta() {      // supervivencia: se acabó el reloj de la pregunta
        const s = this.state, q = s.q;
        if (!q || q.resuelta) return;
        q.resuelta = true;
        this.$('question-area').classList.add('bloqueado');
        s.total++;
        s.streak = 0;
        updateStreak(0);
        if (!s.falladas.includes(q.op.clave)) s.falladas.push(q.op.clave);
        s.lives--;
        this.pintarVidas();
        this.$('answer-note').innerHTML = '⏰ ¡Tiempo! ' + this.notaRespuesta(q, false);
        this.feedback(false);
        if (VozUI.respuestaEn(s.mode) && !VozUI.explicarEn(s.mode)) {      // ventana con la respuesta (el reloj se para mientras está abierta)
            (async () => {
                if (s.lives <= 0) Sonido.musica('fin');
                await this.mostrarRespuesta(q, '⏰ ¡Se acabó el tiempo!');
                if (!s.isPlaying) return;
                if (s.lives <= 0) this.endGame(); else this.siguientePregunta();
            })();
            return;
        }
        if (s.lives <= 0) this.later(() => this.endGame(), 2000);
        else this.later(() => this.siguientePregunta(), 1800);
    },

    feedback(ok) {
        Sonido.efecto(ok ? 'acierto' : 'error');
        const overlay = this.$('feedback-overlay');
        // el color no se quita al acabar (si no, desaparecía de golpe): solo se sube y se baja la opacidad, con un fundido rápido
        clearTimeout(this._tFeedback);
        overlay.className = 'feedback-fx ' + (ok ? 'correct' : 'wrong');
        void overlay.offsetWidth;
        overlay.classList.add('on');
        if (!ok) restartAnimation(document.querySelector('.game-board'), 'shake');
        this._tFeedback = setTimeout(() => { overlay.classList.remove('on'); }, 220);
    },

    popup(texto, clase) {
        const board = document.querySelector('.game-board');
        const pop = document.createElement('div');
        pop.className = 'speed-popup speed-text-' + clase;
        pop.textContent = texto;
        board.appendChild(pop);
        // «Paso a paso»: el cartel no flota por encima de las operaciones que suben y se reducen; se queda quieto justo encima del historial
        // (en el hueco que hay entre la pregunta y las operaciones), más pequeño si no cabe
        const area = this.$('question-area'), hist = this.state.q && this.state.q.tipo === 'pasos' && area.querySelector('.historial');
        if (hist) {
            pop.classList.add('fija');
            const tabla = board.getBoundingClientRect(), rango = document.createRange();
            rango.selectNodeContents(this.$('question-text'));          // el texto real (la caja de la pregunta es más alta que su última línea)
            const tope = rango.getBoundingClientRect().bottom - tabla.top;
            let tam = parseFloat(getComputedStyle(pop).fontSize);
            // centrado en vertical entre el texto de la pregunta (arriba) y el historial (abajo); si no cabe, más pequeño
            const colocar = () => { const hueco = hist.getBoundingClientRect().top - tabla.top - tope; pop.style.top = (tope + (hueco - pop.offsetHeight) / 2) + 'px'; return hueco; };
            while (colocar() < pop.offsetHeight && tam > 12) { tam -= 1; pop.style.fontSize = tam + 'px'; }
            colocar();
        }
        setTimeout(() => pop.remove(), 1200);
    },

    // --- FIN DE PARTIDA ---
    endGame() {
        const s = this.state;
        if (!s.isPlaying) return;
        Voz.parar();
        s.isPlaying = false;
        clearInterval(s.timerId);
        this.clearLater();
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }

        const precision = s.total > 0 ? Math.round(s.aciertos / s.total * 100) : 0;
        animateCount(this.$('res-score'), s.score);
        this.$('res-jugador').textContent = s.playerName;
        this.$('res-accuracy').textContent = precision + '%';
        this.$('res-streak').textContent = s.maxStreak;
        this.$('res-detail').textContent = this.MODOS[s.mode].charAt(0) + this.MODOS[s.mode].slice(1).toLowerCase() +
            ' · ' + this.TIPOS[s.actividad].nombre + ' · ' + (s.nivel ? 'nivel ' + s.nivel : 'nivel mixto') +
            ' · ' + s.aciertos + ' de ' + s.total + ' correctas';

        const rep = this.$('res-repasar');
        if (s.falladas.length) {
            rep.innerHTML = '<b>Para repasar:</b><br>' + s.falladas.slice(0, 8).map(w => '<span class="pal">' + esc(w) + '</span>').join('');
        } else rep.innerHTML = s.total ? '¡Sin ninguna operación para repasar!' : '';

        const msg = this.$('res-message');
        if (!s.total) msg.textContent = 'Esta vez no ha dado tiempo a responder.';
        else if (precision >= 90) msg.textContent = '¡Maestro del orden de las operaciones!';
        else if (precision >= 70) msg.textContent = '¡Muy buen trabajo!';
        else if (precision >= 50) msg.textContent = 'Vas por buen camino. ¡Sigue practicando!';
        else msg.textContent = 'Repasa las operaciones de arriba y vuelve a intentarlo.';

        if (s.mode !== 'practice' && s.score > 0) this.guardarRanking();
        if (precision >= 90 && s.total >= 8) launchConfetti();

        this.later(() => this.showScreen('screen-results', true), 600);
    },

    // --- RANKING LOCAL ---
    claveRanking(modo, tiempo) { return modo === 'timeattack' ? 'timeattack_' + tiempo : modo; },

    guardarRanking() {
        const s = this.state;
        const modoKey = this.claveRanking(s.mode, s.tiempo);
        const clave = modoKey + '|' + s.actividad;
        const todos = this.leer('ranking', {});
        const lista = todos[clave] || [];
        lista.push({ name: s.playerName, score: s.score, date: new Date().toLocaleDateString('es-ES') });
        lista.sort((a, b) => b.score - a.score);
        todos[clave] = lista.slice(0, 10);
        this.guardar('ranking', todos);
        s.lastRankingKey = { modo: modoKey, actividad: s.actividad };
    },

    abrirRanking() {
        const k = this.state.lastRankingKey;
        if (k) {
            this.$('ranking-mode-select').value = k.modo;
            this.$('ranking-activity-select').value = k.actividad;
        }
        this.renderRanking();
    },

    renderRanking() {
        const clave = this.$('ranking-mode-select').value + '|' + this.$('ranking-activity-select').value;
        const datos = this.leer('ranking', {})[clave] || [];
        const tbody = this.$('ranking-body');
        tbody.innerHTML = '';
        if (!datos.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aún no hay puntuaciones.</td></tr>';
            return;
        }
        datos.forEach((e, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + esc(e.name) + '</td><td>' + esc(e.score) + '</td><td>' + esc(e.date) + '</td>';
            tbody.appendChild(tr);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
