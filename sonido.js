/* =========================================================
   Sonido · música de fondo (en bucle sin cortes) y efectos
   La elección de música / efectos se guarda en localStorage.
   Sonido.musica('menu' | 'fin' | 'timeattack' | 'sudden_death' | 'survival' | 'practice')
   Sonido.efecto('click' | 'acierto' | 'error' | 'start')
   ========================================================= */
window.Sonido = (function () {

    var K_MUSICA = 'combinadas.musica', K_EFECTOS = 'combinadas.efectos';
    function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    var musicaOn = leer(K_MUSICA) !== '0';
    var efectosOn = leer(K_EFECTOS) !== '0';

    var PISTAS = {
        menu: 'music/titulo.mp3', fin: 'music/fin.ogg',
        timeattack: 'music/2.ogg', sudden_death: 'music/3.ogg', survival: 'music/2.ogg', practice: 'music/1.ogg'
    };
    var VOLUMEN = { menu: 0.4, fin: 0.4 };
    var EFECTOS = {
        click: 'music/click.wav', acierto: 'music/acierto.mp3', error: 'music/error.mp3', start: 'music/start.mp3'
    };

    var pistas = {};      // archivo → MusicaBucle (se crean al pedirlas)
    var actual = null;    // nombre de la pista que debe sonar
    var fx = {};

    function efecto(nombre, volumen) {
        if (!efectosOn || !EFECTOS[nombre]) return;
        try {
            var a = fx[nombre] || (fx[nombre] = new Audio(EFECTOS[nombre]));
            a.pause();
            a.currentTime = 0;
            a.volume = volumen == null ? 1 : volumen;
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
    }

    /* «Woosh» al cortar: barrido de ruido que sube de grave a agudo, como el amarillo subiendo por la línea.
       Se genera con Web Audio (no necesita archivo). */
    var ctxFx = null, ruido = null;
    function woosh() {
        if (!efectosOn) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctxFx = ctxFx || new AC();
            if (ctxFx.state === 'suspended') ctxFx.resume();
            if (!ruido) {
                var n = Math.floor(ctxFx.sampleRate * 0.4), buf = ctxFx.createBuffer(1, n, ctxFx.sampleRate), d = buf.getChannelData(0);
                for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
                ruido = buf;
            }
            var t = ctxFx.currentTime, dur = 0.24;
            var src = ctxFx.createBufferSource(); src.buffer = ruido;
            var bp = ctxFx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
            bp.frequency.setValueAtTime(450, t); bp.frequency.exponentialRampToValueAtTime(3400, t + dur);
            var g = ctxFx.createGain();
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(bp); bp.connect(g); g.connect(ctxFx.destination);
            src.start(t); src.stop(t + dur + 0.03);
        } catch (e) {}
    }

    function pista(nombre) {
        var src = PISTAS[nombre], p = pistas[src];
        if (!p) {
            p = pistas[src] = new MusicaBucle(src, { preload: 'auto' });
            p.base = VOLUMEN[nombre] || 0.3;
            p.volume = p.base * nivel;
        }
        return p;
    }

    function tocar(nombre) {
        var r;
        try { r = pista(nombre).play(); } catch (e) {}
        if (r && r.catch) r.catch(function () { /* el navegador espera un primer toque: ver desbloquear() */ });
    }

    function parar() {
        Object.keys(pistas).forEach(function (s) { try { pistas[s].pause(); } catch (e) {} });
    }

    /* Cambiar de pista (o de modo) la empieza desde el principio; si ya suena la misma, sigue.
       Con reiniciar = true vuelve a empezar aunque ya estuviera sonando. */
    function musica(nombre, reiniciar) {
        actual = nombre;
        if (!musicaOn || !PISTAS[nombre]) return;
        var src = PISTAS[nombre];
        Object.keys(pistas).forEach(function (s) { if (s !== src) pistas[s].pause(); });
        var p = pistas[src];
        if (p && !p.paused && !reiniciar) return;
        if (p) { p.pause(); p.currentTime = 0; }
        tocar(nombre);
    }

    /* Baja la música mientras habla la voz con un fundido suave y la devuelve igual de suave.
       atenuar(true) devuelve una promesa que se cumple cuando la música YA ha bajado: la voz espera a eso.
       La subida solo empieza cuando se pide (al terminar de hablar). Entre dos frases seguidas no sube:
       la subida espera un momento por si llega otra. mantenerBajo(true) la deja baja hasta mantenerBajo(false). */
    var NIVEL_BAJO = 0.15, nivel = 1, rampa = null, soltar = null, bloqueada = false;
    var rampaPromesa = null, rampaObjetivo = null, resolverRampa = null;
    function aplicarNivel() {
        Object.keys(pistas).forEach(function (s) { try { pistas[s].volume = (pistas[s].base || 0.3) * nivel; } catch (e) {} });
    }
    function irA(objetivo, ms) {
        if (rampa) cancelAnimationFrame(rampa);
        if (resolverRampa) { resolverRampa(); resolverRampa = null; }
        if (Math.abs(nivel - objetivo) < 0.005) { rampa = null; rampaObjetivo = null; return Promise.resolve(); }
        var inicio = nivel, t0 = performance.now();
        rampaObjetivo = objetivo;
        rampaPromesa = new Promise(function (ok) {
            resolverRampa = ok;
            function paso(ahora) {
                var t = Math.min(1, (ahora - t0) / ms);
                var suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                nivel = inicio + (objetivo - inicio) * suave;
                aplicarNivel();
                if (t < 1) rampa = requestAnimationFrame(paso);
                else { rampa = null; rampaObjetivo = null; resolverRampa = null; ok(); }
            }
            rampa = requestAnimationFrame(paso);
        });
        return rampaPromesa;
    }
    /* rapido = true para una palabra suelta (fundidos cortos); si no, fundidos largos para una narración */
    function atenuar(on, rapido) {
        clearTimeout(soltar);
        if (on) {
            if (rampaObjetivo === NIVEL_BAJO && rampaPromesa) return rampaPromesa;     // ya está bajando: se espera a que acabe
            return irA(NIVEL_BAJO, rapido ? 70 : 450);
        }
        if (!bloqueada) soltar = setTimeout(function () { irA(1, rapido ? 150 : 650); }, rapido ? 0 : 400);
        return Promise.resolve();
    }
    function mantenerBajo(on) {
        bloqueada = !!on;
        if (on) return atenuar(true, false);
        return atenuar(false, false);
    }

    function silenciar() { actual = null; parar(); }

    /* Los navegadores no dejan sonar hasta el primer toque: entonces se reanuda lo pendiente */
    function desbloquear() {
        if (musicaOn && actual) {
            var p = pistas[PISTAS[actual]];
            if (!p || p.paused) tocar(actual);
        }
    }
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, desbloquear, true); });      // iOS: solo arranca dentro de touchend / click

    return {
        musica: musica,
        parar: silenciar,
        efecto: efecto,
        woosh: woosh,
        atenuar: atenuar,
        mantenerBajo: mantenerBajo,
        musicaActiva: function () { return musicaOn; },
        efectosActivos: function () { return efectosOn; },
        alternarMusica: function () {
            musicaOn = !musicaOn;
            escribir(K_MUSICA, musicaOn ? '1' : '0');
            if (musicaOn) { if (actual) musica(actual, true); } else parar();
            return musicaOn;
        },
        alternarEfectos: function () {
            efectosOn = !efectosOn;
            escribir(K_EFECTOS, efectosOn ? '1' : '0');
            return efectosOn;
        }
    };

})();
