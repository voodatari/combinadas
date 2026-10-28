/* =========================================================
   Voz · síntesis de voz en español, con dos motores a elegir en Opciones:
     VozPiper → Piper (Sharvard, España, mujer), en local (WebAssembly en un Web Worker)
     VozWeb   → la voz española del navegador (Web Speech API), al final de este archivo
     Voz      → lo que usa el resto de la web: pasa las órdenes al motor elegido
   Lo que sigue describe la interfaz común (la de Piper es la completa).

   Piper: todo se carga UNA vez al entrar (runtime ONNX, fonemizador espeak-ng y modelo de voz) y se queda
   en memoria; no hay peticiones a servidores externos. Las frases ya sintetizadas se guardan en una caché.
   La síntesis ocurre en un hilo aparte (voz-worker.js): el juego y sus animaciones no se atascan.

   Voz.iniciar(progreso)        → carga todo (promesa; se puede llamar varias veces). progreso(0..1, estado)
   Voz.decir(texto, opciones)   → pronuncia el texto; la promesa se resuelve al terminar o al cortarse
        texto: una cadena, o una lista de segmentos [cadena | { t: cadena, pausa: ms }]
        opciones.pausa      → silencio (ms) tras cada segmento/frase (por defecto 0)
        opciones.rapido     → fundido rápido de la música (para una palabra suelta)
        opciones.vel        → velocidad de todo el texto (0,85 = un poco más lento)
        opciones.claro      → articula la g suave entre vocales (ahogo, lago…)
        opciones.palabra    → { silabas, tonica, portadora }: se le da a Piper el acento correcto (espeak se equivoca con palabras sueltas);
                              con portadora ('la') se sintetiza «la, palabra» y se descarta el «la»: dicha sola, una palabra suena peor
        un segmento { sil: [sílabas], ton: índice } se dice SÍLABA A SÍLABA en un solo enunciado, con las vocales alargadas;
        alFrase recibe como 5.º argumento las marcas (segundos en que empieza cada sílaba)
        opciones.alFrase(i, total, segundos, segmento) → al empezar cada frase
        un segmento { t, pausa, vel, acento } puede llevar su velocidad (vel 1.2 = un 20 % más rápido)
        y su acento ('tonica' | 'atona': una sílaba suelta suena acentuada o no)
   Voz.parar()                  → corta lo que esté sonando
   Voz.precargar(texto)         → sintetiza por adelantado (para que decir() sea instantáneo)
   Voz.estado()                 → 'sin-cargar' | 'cargando' | 'lista' | 'error'
   ========================================================= */
var VozPiper = (function () {

    /* Cómo se dice una palabra sílaba a sílaba:
       'trozos'   → cada sílaba por separado, escrita con guion («di-» «ri-» «gen-» «te-»), con una pausa corta; la tónica con acento y algo más lenta
       'continuo' → toda la palabra en un solo enunciado con las vocales alargadas (se probó: sonaba peor) */
    var MODO_SILABEO = 'trozos';
    var PAUSA_ENTRE_SILABAS = 280, VEL_ATONA_TROZOS = 0.6, VEL_TONICA_TROZOS = 0.45;
    function textoSilaba(s, k) { return s.replace(/^rr/, 'r').replace(/^x/, k === 0 ? 's' : 'ks') + '-'; }   // «rrí» lo lee espeak como letras («erre-í»); x → s / ks

    var estado = 'sin-cargar', error = null, promesaCarga = null, progresoActual = 0;
    var escuchas = [];                    // funciones que quieren saber el progreso
    var worker = null, tasa = 22050;
    var pendientes = {}, idSig = 1;       // peticiones de síntesis en curso
    var cache = new Map();                // texto → Promise<Float32Array>
    var ctx = null, fuente = null, token = 0, hablando = 0, rapidoAct = false;

    function avisarProgreso(f) { progresoActual = f; escuchas.forEach(function (fn) { try { fn(f, estado); } catch (e) {} }); }

    function iniciar(progreso) {
        if (progreso) { escuchas.push(progreso); progreso(progresoActual, estado); }
        if (promesaCarga) return promesaCarga;
        if (!window.Worker || !window.WebAssembly) { estado = 'error'; error = new Error('Este navegador no admite WebAssembly'); avisarProgreso(0); return Promise.reject(error); }
        estado = 'cargando';
        promesaCarga = new Promise(function (ok, mal) {
            try { worker = new Worker('voz-worker.js?v=20261012c'); } catch (e) { estado = 'error'; error = e; promesaCarga = null; return mal(e); }
            worker.onmessage = function (ev) {
                var m = ev.data;
                if (m.t === 'progreso') avisarProgreso(m.f);
                else if (m.t === 'lista') { tasa = m.sr; estado = 'lista'; avisarProgreso(1); ok(); }
                else if (m.t === 'error') { estado = 'error'; error = new Error(m.msg); console.warn('Voz: no se pudo cargar Piper', m.msg); avisarProgreso(progresoActual); mal(error); }
                else if (m.t === 'pcm' && pendientes[m.id]) { pendientes[m.id].ok({ pcm: m.pcm, marcas: m.marcas }); delete pendientes[m.id]; }
                else if (m.t === 'fallo' && pendientes[m.id]) { pendientes[m.id].mal(new Error(m.msg)); delete pendientes[m.id]; }
            };
            worker.onerror = function (ev) { if (estado !== 'lista') { estado = 'error'; error = new Error(ev.message || 'Error en el worker'); avisarProgreso(progresoActual); mal(error); } };
            worker.postMessage({ t: 'init' });
        });
        promesaCarga.catch(function () {});
        return promesaCarga;
    }

    function sintetizar(texto, vel, acento, claro, extra) {
        vel = vel || 1;
        var clave = vel === 1 && !acento && !claro && !extra ? texto : texto + '|' + vel + '|' + (acento || '') + '|' + (claro ? 'c' : '') + (extra ? '|' + extra.tipo + ':' + extra.silabas.join('-') + ':' + extra.tonica + ':' + (extra.portadora || '') : '');      // la misma frase a otra velocidad es otro audio
        if (cache.has(clave)) return cache.get(clave);
        var p = iniciar().then(function () {
            return new Promise(function (ok, mal) {
                var id = idSig++;
                pendientes[id] = { ok: ok, mal: mal };
                worker.postMessage({ t: 'sint', id: id, texto: texto, escala: 1 / vel, acento: acento || null, claro: !!claro, extra: extra || null });
            });
        });
        cache.set(clave, p);
        p.catch(function () { cache.delete(clave); });
        return p;
    }

    function contexto() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!ctx && AC) { try { ctx = new AC(); } catch (e) {} }
        if (ctx && ctx.state === 'suspended') { var r = ctx.resume(); if (r && r.catch) r.catch(function () {}); }
        return ctx;
    }

    function atenuar(on, rapido) {
        return (window.Sonido && Sonido.atenuar) ? Sonido.atenuar(on, rapido) : Promise.resolve();
    }

    function parar() {
        token++;
        if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) {} fuente = null; }
        if (hablando) { hablando = 0; atenuar(false, rapidoAct); }
    }

    function reproducir(pcm, miToken) {
        return new Promise(function (ok) {
            var c = contexto();
            if (!c || miToken !== token) return ok();
            var buf = c.createBuffer(1, pcm.length, tasa);
            buf.copyToChannel(pcm, 0);
            var src = c.createBufferSource();
            src.buffer = buf; src.connect(c.destination);
            fuente = src;
            src.onended = function () { if (fuente === src) fuente = null; ok(); };
            src.start();
        });
    }

    function pausar(ms, miToken) {
        return new Promise(function (ok) { setTimeout(ok, ms); }).then(function () { return miToken === token; });
    }

    /* Trocea un texto en frases para empezar a hablar antes de tenerlo todo sintetizado */
    function frases(texto) {
        var t = String(texto).replace(/\s+/g, ' ').trim();
        if (!t) return [];
        var partes = t.match(/[^.!?…:;]+[.!?…:;]*\s*/g) || [t];
        var out = [];
        partes.forEach(function (p) {
            p = p.trim();
            if (!p) return;
            if (p.length <= 200) out.push(p);
            else p.split(/,\s*/).forEach(function (x, i, a) { if (x.trim()) out.push(x.trim() + (i < a.length - 1 ? ',' : '')); });
        });
        return out;
    }

    /* cadena o lista de segmentos → lista plana de { texto, pausa, seg } */
    function normalizar(entrada, pausaPorDefecto, def) {
        def = def || {};
        var out = [];
        (Array.isArray(entrada) ? entrada : [entrada]).forEach(function (el, idx) {
            if (typeof el === 'object' && el.sil && MODO_SILABEO === 'trozos') {      // una síntesis por sílaba
                el.sil.forEach(function (s, k) {
                    var t = textoSilaba(s, k), esTon = k === el.ton;
                    out.push({ texto: t, pausa: k < el.sil.length - 1 ? PAUSA_ENTRE_SILABAS : (el.pausa != null ? el.pausa : pausaPorDefecto), seg: idx, silK: k,
                        vel: esTon ? VEL_TONICA_TROZOS : VEL_ATONA_TROZOS, acento: esTon ? 'tonica' : 'atona', claro: true,
                        extra: { tipo: 'silabaTexto', texto: t, tonica: esTon, silabas: [t] } });
                });
                return;
            }
            if (typeof el === 'object' && el.sil) {            // sílaba a sílaba, en un solo enunciado
                out.push({ texto: el.sil.join('-'), pausa: el.pausa != null ? el.pausa : pausaPorDefecto, seg: idx, vel: 1, acento: null, claro: true,
                    extra: { tipo: 'silabeo', silabas: el.sil, tonica: el.ton, palabra: el.sil.join('') } });
                return;
            }
            var texto = typeof el === 'string' ? el : el.t;
            var pausa = typeof el === 'object' && el.pausa != null ? el.pausa : pausaPorDefecto;
            frases(texto).forEach(function (f) {
                out.push({ texto: f, pausa: pausa, seg: idx, vel: typeof el === 'object' && el.vel ? el.vel : (def.vel || 1), acento: typeof el === 'object' ? el.acento : null, claro: !!def.claro,
                    extra: def.palabra ? { tipo: 'palabra', silabas: def.palabra.silabas, tonica: def.palabra.tonica, portadora: def.palabra.portadora } : null });
            });
        });
        return out;
    }

    async function decir(texto, opciones) {
        opciones = opciones || {};
        if (estado === 'error') return false;
        parar();
        var miToken = token;
        try { await iniciar(); } catch (e) { return false; }
        if (miToken !== token) return false;
        var lista = normalizar(texto, opciones.pausa || 0, { vel: opciones.vel, claro: opciones.claro, palabra: opciones.palabra });
        if (!lista.length) return false;
        var siguiente = sintetizar(lista[0].texto, lista[0].vel, lista[0].acento, lista[0].claro, lista[0].extra);
        hablando = 1; rapidoAct = !!opciones.rapido;
        try {
            await atenuar(true, rapidoAct);                  // la voz espera a que la música haya terminado de bajar
            if (miToken !== token) return false;
            for (var i = 0; i < lista.length; i++) {
                var resp = await siguiente, pcm = resp.pcm;
                if (miToken !== token) return false;
                if (i + 1 < lista.length) siguiente = sintetizar(lista[i + 1].texto, lista[i + 1].vel, lista[i + 1].acento, lista[i + 1].claro, lista[i + 1].extra);   // mientras suena esta, se prepara la siguiente (en el worker)
                if (opciones.alFrase) { try { opciones.alFrase(i, lista.length, pcm.length / tasa, lista[i].seg, resp.marcas, lista[i].silK); } catch (e) {} }
                await reproducir(pcm, miToken);
                if (miToken !== token) return false;
                if (lista[i].pausa && i + 1 < lista.length && !(await pausar(lista[i].pausa, miToken))) return false;
            }
        } catch (e) { return false; }
        if (miToken === token) { hablando = 0; atenuar(false, rapidoAct); }
        return true;
    }

    function precargar(texto, opciones) {
        opciones = opciones || {};
        if (estado === 'error') return Promise.resolve();
        return Promise.all(normalizar(texto, 0, { vel: opciones.vel, claro: opciones.claro, palabra: opciones.palabra }).map(function (f) { return sintetizar(f.texto, f.vel, f.acento, f.claro, f.extra); })).catch(function () {});
    }

    /* Primer toque del usuario: los navegadores móviles solo dejan sonar el audio a partir de ahí */
    function desbloquear() {
        var c = contexto();
        if (c) {
            try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
        }
    }
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, desbloquear, { capture: true, passive: true }); });

    return {
        iniciar: iniciar,
        decir: decir,
        parar: parar,
        precargar: precargar,
        estado: function () { return estado; }
    };

})();


/* =========================================================
   Voz del navegador (Web Speech API): la voz española que tenga instalado el dispositivo, sin descargar nada.
   Misma interfaz que Piper (iniciar, decir, parar, precargar, estado), pero más sencilla: cada frase es una locución.
   La voz se elige entre las instaladas: español de España, femenina (como Piper) y lo más natural posible
   (Edge: «Microsoft Elvira Online (Natural)» · Chrome: «Google español» · Windows: «Helena» · Apple: «Mónica»).
   ========================================================= */
var VozWeb = (function () {

    var sint = window.speechSynthesis, soportada = !!(sint && window.SpeechSynthesisUtterance);
    var voz = null, token = 0, hablando = 0, rapidoAct = false, actual = null, sinVozEspanola = false, promesaVoces = null;
    var desbloqueada = false;             // iOS solo deja hablar tras una locución iniciada en un toque
    var mudo = false;                     // la última locución no llegó a sonar: se sigue sin voz (con los tiempos de lectura) hasta el siguiente toque
    var avisos = [];                      // quien quiera saber cuándo cambia la voz elegida

    /* Cuánto se parece una voz instalada a la que queremos (-1 = no sirve: no es español) */
    function puntuar(v) {
        var n = (v.name || '').toLowerCase(), l = (v.lang || '').toLowerCase().replace('_', '-'), p = 0;
        var esES = l.indexOf('es') === 0 || /spa(n|ñ)ish|espa(n|ñ)ol|castellano/.test(n);        // algunos sistemas dan mal el idioma pero sí el nombre
        if (!esES) return -1;
        p += l === 'es-es' ? 50 : (l === 'es-mx' || l === 'es-us' || l === 'es-419') ? 12 : 6;
        if (/natural|neural|online/.test(n)) p += 40;                                                             // voces neuronales (Edge)
        if (/google/.test(n)) p += 25;                                                                            // Chrome
        if (/elvira|helena|laura|m[oó]nica|luc[ií]a|paulina|marisol|esperanza|sabina|dalia|female|mujer/.test(n)) p += 15;
        if (/[aá]lvaro|alonso|pablo|jorge|juan|diego|ra[uú]l|enrique|carlos|\bmale\b|hombre/.test(n)) p -= 30;     // Piper (Sharvard) es una voz de mujer
        if (v.default) p += 2;
        return p;
    }
    function elegirVoz() {
        var lista = soportada ? (sint.getVoices() || []) : [], mejor = null, pm = -1;
        lista.forEach(function (v) { var p = puntuar(v); if (p > pm) { pm = p; mejor = v; } });
        sinVozEspanola = lista.length > 0 && !mejor;                    // hay voces, pero ninguna en español
        if (mejor !== voz) { voz = mejor; avisos.forEach(function (f) { try { f(voz); } catch (e) {} }); }
        return voz;
    }
    /* Los navegadores cargan la lista de voces en segundo plano (Safari ni siquiera avisa con «voiceschanged»): se espera a que llegue
       o 1,5 s como mucho, y la lista se vuelve a leer cada vez que se necesita */
    function cargarVoces() {
        if (promesaVoces) return promesaVoces;
        promesaVoces = new Promise(function (ok) {
            if (!soportada) return ok(null);
            var hecho = false;
            function fin() { if (!hecho) { hecho = true; ok(elegirVoz()); } }
            if (sint.addEventListener) sint.addEventListener('voiceschanged', function () { elegirVoz(); fin(); });
            if ((sint.getVoices() || []).length) fin(); else setTimeout(fin, 1500);
        });
        return promesaVoces;
    }

    function iniciar(progreso) {
        if (!soportada) { if (progreso) progreso(0, 'error'); return Promise.reject(new Error('Este navegador no tiene síntesis de voz')); }
        return cargarVoces().then(function () {
            elegirVoz();
            if (sinVozEspanola) { if (progreso) progreso(0, 'error'); throw new Error('No hay ninguna voz en español instalada'); }
            if (progreso) progreso(1, 'lista');
        });
    }

    function atenuar(on, rapido) { return (window.Sonido && Sonido.atenuar) ? Sonido.atenuar(on, rapido) : Promise.resolve(); }
    function pausar(ms, miToken) { return new Promise(function (ok) { setTimeout(ok, ms); }).then(function () { return miToken === token; }); }

    function parar() {
        token++;
        if (soportada && (hablando || actual)) { try { sint.cancel(); } catch (e) {} }
        actual = null;
        if (hablando) { hablando = 0; atenuar(false, rapidoAct); }
    }

    /* Habla una frase; devuelve true si de verdad llegó a sonar (si no arranca en 2,5 s, se da por perdida) */
    function hablar(texto, vel) {
        return new Promise(function (ok) {
            var u = new SpeechSynthesisUtterance(texto), terminada = false, empezo = false, seguro, arranque;
            u.lang = voz ? voz.lang : 'es-ES';
            if (voz) u.voice = voz;
            u.rate = Math.max(0.6, Math.min(1.5, 0.95 * (vel || 1)));
            u.pitch = 1; u.volume = 1;
            function fin() { if (terminada) return; terminada = true; clearTimeout(seguro); clearTimeout(arranque); if (actual === u) actual = null; ok(empezo); }
            u.onstart = function () { empezo = true; };
            u.onend = fin; u.onerror = fin;
            actual = u;                                                  // si nadie guarda la locución, Chrome puede no avisar de que ha terminado
            seguro = setTimeout(fin, 4000 + texto.length * 170);         // por si algún navegador no avisa
            arranque = setTimeout(function () { if (!empezo) fin(); }, 2500);
            try { if (sint.paused) sint.resume(); sint.speak(u); } catch (e) { fin(); }
        });
    }

    /* cadena o lista de cadenas / { t, pausa, vel } → lista plana de { texto, pausa, vel, seg } */
    function normalizar(entrada, pausaPorDefecto) {
        var out = [];
        (Array.isArray(entrada) ? entrada : [entrada]).forEach(function (el, idx) {
            var t = typeof el === 'string' ? el : (el && el.t);
            if (!t || !String(t).replace(/\s+/g, '')) return;
            out.push({ texto: String(t).replace(/\s+/g, ' ').trim(), pausa: typeof el === 'object' && el.pausa != null ? el.pausa : pausaPorDefecto, vel: typeof el === 'object' ? el.vel : null, seg: idx });
        });
        return out;
    }

    /* iOS (y algunos móviles) solo dejan hablar si la primera locución se inicia DENTRO de un toque: se lanza una muda en el primer toque
       y, además, al empezar cada decir() (que en un botón va todavía dentro del toque) */
    function desbloquear() {
        if (!soportada || desbloqueada) return;
        desbloqueada = true;
        try { var u = new SpeechSynthesisUtterance('a'); u.volume = 0; u.lang = 'es-ES'; sint.speak(u); } catch (e) { desbloqueada = false; }
    }
    ['click', 'touchend', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, function () { desbloquear(); mudo = false; }, { capture: true, passive: true });
    });

    async function decir(texto, opciones) {
        opciones = opciones || {};
        if (!soportada) return false;
        parar();
        desbloquear();                                                   // síncrono: todavía dentro del toque que lo pidió
        var miToken = token;
        await cargarVoces();
        elegirVoz();
        if (miToken !== token || sinVozEspanola) return false;
        var lista = normalizar(texto, opciones.pausa || 0);
        if (!lista.length) return false;
        hablando = 1; rapidoAct = !!opciones.rapido;
        try {
            await atenuar(true, rapidoAct);                              // la voz espera a que la música haya bajado
            if (miToken !== token) return false;
            if (!(await pausar(60, miToken))) return false;              // Chrome pierde la primera locución si llega justo después de un cancel()
            for (var i = 0; i < lista.length; i++) {
                var f = lista[i], duracion = Math.max(1, f.texto.length * 0.065);
                if (opciones.alFrase) { try { opciones.alFrase(i, lista.length, duracion, f.seg, null, undefined); } catch (e) {} }
                if (mudo) { if (!(await pausar(800 + f.texto.length * 62, miToken))) return false; }       // sin voz: lo que tardaría en leerse
                else {
                    var sono = await hablar(f.texto, (opciones.vel || 1) * (f.vel || 1));
                    if (miToken !== token) return false;
                    if (!sono) mudo = true;
                }
                if (f.pausa && i + 1 < lista.length && !(await pausar(f.pausa, miToken))) return false;
            }
        } catch (e) { return false; }
        if (miToken === token) { hablando = 0; atenuar(false, rapidoAct); }
        return true;
    }

    return {
        disponible: function () { return soportada; },
        iniciar: iniciar,
        decir: decir,
        parar: parar,
        precargar: function () { return Promise.resolve(); },
        estado: function () { if (soportada && !voz) elegirVoz(); return !soportada || sinVozEspanola ? 'error' : 'lista'; },
        /* nombre de la voz elegida (para enseñarlo en las opciones), o '' si aún no se sabe */
        nombre: function () { if (soportada && !voz) elegirVoz(); return voz ? voz.name : ''; },
        /* la última frase no llegó a sonar (el navegador no la reprodujo) */
        mudo: function () { return mudo; },
        alCambiarVoz: function (f) { avisos.push(f); cargarVoces(); }
    };

})();


/* =========================================================
   Voz · lo que usa el resto de la web: elige el motor (Piper o la voz del navegador) y le pasa las órdenes.
   La elección se guarda en localStorage («combinadas.motorVoz») y la cambia voz-ui.js desde Opciones.
   Voz.motor() → 'piper' | 'web' · Voz.fijarMotor(m) · Voz.webDisponible() · Voz.nombreVozWeb()
   ========================================================= */
window.Voz = (function () {

    var CLAVE = 'combinadas.motorVoz', motor = 'piper';
    try { if (localStorage.getItem(CLAVE) === 'web') motor = 'web'; } catch (e) {}
    if (motor === 'web' && !VozWeb.disponible()) motor = 'piper';
    function actual() { return motor === 'web' ? VozWeb : VozPiper; }

    return {
        iniciar: function (progreso) { return actual().iniciar(progreso); },
        decir: function (texto, opciones) { return actual().decir(texto, opciones); },
        precargar: function (texto, opciones) { return actual().precargar(texto, opciones); },
        estado: function () { return actual().estado(); },
        parar: function () { VozPiper.parar(); VozWeb.parar(); },
        motor: function () { return motor; },
        fijarMotor: function (nuevo) {
            if (nuevo !== 'piper' && nuevo !== 'web') return;
            if (nuevo === 'web' && !VozWeb.disponible()) return;
            VozPiper.parar(); VozWeb.parar();
            motor = nuevo;
            try { localStorage.setItem(CLAVE, nuevo); } catch (e) {}
        },
        webDisponible: function () { return VozWeb.disponible(); },
        nombreVozWeb: function () { return VozWeb.nombre(); },
        webMudo: function () { return VozWeb.mudo(); },
        alCambiarVozWeb: function (f) { VozWeb.alCambiarVoz(f); }
    };

})();
