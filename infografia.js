/* =========================================================
   Infografía animada con voz · explicación paso a paso de un error
   Cada explicación se divide en «pasos» (beats): una animación en pantalla + frases que lee Piper.
   Las frases se sintetizan por adelantado en el worker de voz, así que el paso siguiente suena sin esperas.
   Si la voz no está disponible, las animaciones siguen solas, con el tiempo de lectura de cada frase.

   Infografia.mostrar(datos)  → promesa que se resuelve al cerrarla
   Infografia.preparar(datos) → empieza a sintetizar las frases (llamar en cuanto se falla)
   Infografia.guion(datos)    → { q, beats } (la versión escrita usa los mismos textos: explicacion.js)

   datos = { tipo: 'reconocer' | 'igualdad' | 'arrastrar' | 'pasos', q: <operación>, elegida: …, opcion: … }
     reconocer → elegida: fichas del par que eligió el alumno (el que NO va primero); opcion: esa opción (con su cons: qué saldría)
     igualdad / pasos → elegida: fichas de la opción que eligió (q: la operación tal como estaba en esa pregunta: Op.desde)
     arrastrar → elegida: fichas de lo que montó el alumno

   La escena mueve las MISMAS fichas de la operación: cada paso se funde en su resultado
   (técnica FLIP) y se acompaña de la cuenta completa y de la regla del orden.
   ========================================================= */
window.Infografia = (function () {

    function el(tag, cls, html) { var x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }

    /* tiempos (ms): silencio entre frases y entre pasos */
    var PAUSA_FRASE = 650, PAUSA_PASO = 1200;

    /* ---------- guiones ---------- */
    var ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto'];

    /* Las dos etiquetas de arriba («Tu respuesta» / «Correcta») se ven desde el primer paso y durante toda la explicación. */
    function etiquetas(d) {
        var q = d.q, mal = Op.texto(d.elegida);
        if (d.tipo === 'reconocer') return { mal: mal, bien: Op.texto(Op.primerPaso(q)) };
        if (q.n <= 1) return { mal: mal, bien: String(q.calc.total) };       // la última pregunta de «Paso a paso»: el valor
        return { mal: mal, bien: Op.texto(Op.siguiente(q)) };
    }
    function beatTitulo(d) {
        var q = d.q, t = etiquetas(d);
        return {
            cap: 'Vamos a mirar <b>' + Op.texto(q.tokens) + '</b>',
            voz: ['Vamos a mirar esta operación, ' + Op.voz(q) + '.'],
            anim: function (e) { e.pildoras(t.mal, t.bien); e.expr(Op.antes(q)); }
        };
    }

    /* Si lo que eligió el alumno NO vale, se comprueba con números */
    function beatTu(d) {
        var q = d.q, cal = q.calc, el = d.elegida;
        if (d.tipo === 'reconocer') {
            /* qué saldría si se empezara por ese par (el motor lo calcula al preparar las opciones; sin cuenta posible, no hay comprobación) */
            var con = d.opcion && d.opcion.cons;
            if (!con) return null;
            var cuenta = con.cadena.slice();
            cuenta[cuenta.length - 1] = '<b class="ig-mal">' + cuenta[cuenta.length - 1] + '</b>';
            return {
                cap: 'Empezando por <b>' + Op.textoHTML(el) + '</b> saldría <b class="ig-mal">' + con.valor + '</b>, y la operación vale <b>' + cal.total + '</b>.',
                voz: ['Tú has querido empezar por ' + Op.vozTokens(el) + '.', 'Empezando por ahí, saldría ' + con.valor + '.', 'Pero la operación vale ' + cal.total + '.', 'Ese no es el primer paso.'],
                anim: function (e) { e.expr(el); e.centro('calculos'); e.calculos([cuenta.join(' = '), Op.textoHTML(q.tokens) + ' = <b>' + cal.total + '</b>']); },
                seg: function (e, i) { if (i === 1) e.verCalculo(0); else if (i === 2) e.verCalculo(1); else if (i === 3) e.marca(false, '¡No es el primer paso!'); }
            };
        }
        var u = Op.evaluar(el);
        if (u == null || u === cal.total) return null;
        var tuya = el.length === 1 ? 'Tu respuesta: <b class="ig-mal">' + u + '</b>' : Op.textoHTML(el) + ' = <b class="ig-mal">' + u + '</b>';
        return {
            cap: 'Comprobamos tu respuesta: la operación vale <b>' + cal.total + '</b>, pero la tuya da <b class="ig-mal">' + u + '</b>. ¡No coincide!',
            voz: ['Vamos a comprobar tu respuesta.', 'La operación vale ' + cal.total + '.', 'Pero la tuya da ' + u + '.', 'No coincide, así que no vale.'],
            anim: function (e) { e.centro('calculos'); e.calculos([Op.textoHTML(q.tokens) + ' = <b>' + cal.total + '</b>', tuya]); },
            seg: function (e, i) { if (i === 1) e.verCalculo(0); else if (i === 2) e.verCalculo(1); else if (i === 3) e.marca(false, '¡No coinciden!'); }
        };
    }

    function beatRegla(d) {
        var q = d.q, pp = Op.primerPaso(q), p = q.pasos[0], est = Op.antes(q), op = pp.filter(function (t) { return t.k === 'o'; })[0].v;
        var aviso;
        if (p.paren) aviso = est.filter(function (t) { return t.k === 'p' && t.v === '('; }).length > 1 ? 'primero: el paréntesis de la izquierda' : 'primero: el paréntesis';
        else {
            var alto = op === Op.MUL || op === Op.DIV;
            var iguales = est.filter(function (t) { return t.k === 'o' && ((t.v === Op.MUL || t.v === Op.DIV) === alto); }).length;
            aviso = iguales > 1 ? 'primero: la de la izquierda' : 'primero: ' + op;
        }
        return {
            cap: 'La regla del orden: primero el <b>paréntesis</b>, luego <b>× y ÷</b> y al final <b>+ y −</b>. Aquí, lo primero es <b>' + Op.textoHTML(pp) + '</b>.',
            voz: ['Esta es la regla del orden de las operaciones.', 'Primero el paréntesis.', 'Después las multiplicaciones y las divisiones, y al final las sumas y las restas.',
                'Si hay dos del mismo nivel, se empieza por la izquierda.',
                'Aquí lo primero es ' + Op.vozTokens(pp) + '.'],
            anim: function (e) { e.expr(est); e.colorear(true); },
            seg: function (e, i) { e.limpiarResaltes(); if (i === 4) { e.pulso(p.ids); e.bocadillo(aviso); } }
        };
    }

    /* un paso que deja la operación más corta: las fichas se funden en su resultado */
    function beatPaso(d, k) {
        var q = d.q, p = q.pasos[k], sig = Op.siguiente(q, k), nombre = ORDINAL[k] || 'siguiente';
        return {
            cap: 'El ' + nombre + ' paso: <b>' + Op.textoHTML(p.pp.filter(function (t) { return t.k !== 'p'; })) + ' = ' + p.valor + '</b>. La operación queda <b>' + Op.textoHTML(sig) + '</b>.',
            voz: ['El ' + nombre + ' paso es ' + Op.vozTokens(p.pp) + '.', 'Eso da ' + p.valor + '.', 'La operación queda así, ' + Op.vozTokens(sig) + '.'],
            anim: function (e) { e.limpiarResaltes(); e.centro(''); e.expr(Op.antes(q, k)); e.pulso(p.ids); },
            seg: function (e, i) { if (i === 1) { e.limpiarResaltes(); e.expr(sig); } else if (i === 2) e.pulso(['r' + k]); }
        };
    }

    function beatFinal(d) {
        var q = d.q, ult = Op.antes(q, q.n - 1), cal = q.calc;
        var cuentas = q.estados.map(Op.texto);
        cuentas[cuentas.length - 1] = '<b>' + cuentas[cuentas.length - 1] + '</b>';
        return {
            cap: 'Y terminamos: <b>' + Op.textoHTML(ult) + ' = ' + cal.total + '</b>.',
            voz: ['Y terminamos.', Op.vozTokens(ult) + ' son ' + cal.total + '.', 'La operación completa vale ' + cal.total + '.'],
            anim: function (e) { e.limpiarResaltes(); e.centro('calculos'); e.expr(ult); e.calculos([cuentas.join(' = ')]); },
            seg: function (e, i) { if (i === 1) { e.verCalculo(0); e.expr(Op.siguiente(q, q.n - 1)); } else if (i === 2) e.marca(true, q.n > 1 ? '¡Ese es el orden!' : '¡Correcto!'); }
        };
    }

    function beatInsignia() {
        return {
            cap: '<b>El orden de las operaciones</b>: primero el paréntesis, luego × y ÷, después + y −. Del mismo nivel, de izquierda a derecha.',
            voz: ['Recuerda el orden de las operaciones.', 'Primero el paréntesis.', 'Después las multiplicaciones y las divisiones.', 'Al final, las sumas y las restas.',
                'Y si hay dos del mismo nivel, de izquierda a derecha.'],
            anim: function (e) { e.centro('insignia'); e.insignia(Op.regla(), 'El orden de las operaciones'); },
            final: true
        };
    }

    /* Titulo · comprobación · (regla) · un paso por cada operación · (regla otra vez).
       Si solo queda una cuenta (última pregunta de «Paso a paso») no hay orden que recordar. */
    function guion(d) {
        var q = d.q, b = [beatTitulo(d)], tu = beatTu(d), k;
        if (tu) b.push(tu);
        if (q.n > 1) b.push(beatRegla(d));
        for (k = 0; k < q.n - 1; k++) b.push(beatPaso(d, k));
        b.push(beatFinal(d));
        if (q.n > 1) b.push(beatInsignia());
        return { q: q, beats: b };
    }

    var preparados = {};
    function clave(d) { return d.tipo + '|' + d.q.clave + '|' + Op.texto(d.elegida || []); }
    function preparar(d) {
        var k = clave(d);
        if (!preparados[k]) {
            preparados[k] = guion(d);
            if (Voz.estado() !== 'error') preparados[k].beats.forEach(function (x) { Voz.precargar(x.voz); });   // en orden, en el worker
        }
        return preparados[k];
    }

    /* ---------- escena (los elementos animados) ---------- */
    function pintarFila(fila, tokens) {
        fila.innerHTML = '';
        tokens.forEach(function (t) { fila.appendChild(crearFicha(t)); });
    }
    function crearFicha(t) {
        var c = el('span', 'tk tk-' + t.k + (t.rol ? ' rol-' + t.rol : ''), t.v);
        c.dataset.id = t.id; if (t.hacia) c.dataset.hacia = t.hacia;
        return c;
    }

    function Escena(raiz, q, datos) {
        this.q = q; this.raiz = raiz; this.timers = []; this.rapido = false; this.fichas = []; this.estado = {};
        raiz.innerHTML = '';
        var L = el('div', 'ig-lienzo');
        this.pildorasEl = el('div', 'ig-pildoras');
        this.zona = el('div', 'ig-exprzona');
        this.bocadilloEl = el('div', 'ig-bocadillo');
        this.exprEl = el('div', 'ig-expr');
        this.zona.appendChild(this.bocadilloEl); this.zona.appendChild(this.exprEl);
        this.centroEl = el('div', 'ig-centro');
        this.calcEl = el('div', 'ig-calculos');
        this.insEl = el('div', 'ig-insignia');
        this.centroEl.appendChild(this.calcEl); this.centroEl.appendChild(this.insEl);
        L.appendChild(this.pildorasEl); L.appendChild(this.zona); L.appendChild(this.centroEl);
        raiz.appendChild(L);
        this.lienzo = L; L.classList.add('vacio');
        this.encajar();
    }
    var P = Escena.prototype;

    /* ----- iconos (SVG, estilo de los controles de reproducción de Windows 11) ----- */
    var ICO = {
        anterior: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.6" height="14" rx="1.3"/><path d="M19 6.6v10.8c0 .9-1 1.4-1.7.9l-7.8-5.4a1.1 1.1 0 0 1 0-1.8l7.8-5.4c.7-.5 1.7 0 1.7.9z"/></svg>',
        siguiente: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.4" y="5" width="2.6" height="14" rx="1.3"/><path d="M5 6.6v10.8c0 .9 1 1.4 1.7.9l7.8-5.4a1.1 1.1 0 0 0 0-1.8L6.7 5.7C6 5.2 5 5.7 5 6.6z"/></svg>',
        pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
        seguir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8c0 .9 1 1.4 1.7.9l9.6-6.4a1.1 1.1 0 0 0 0-1.8L9.7 4.7C9 4.2 8 4.7 8 5.6z"/></svg>',
        repetir: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4.3v4.8h-4.8"/></svg>',
        saltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.8v10.4c0 .8.9 1.3 1.6.8l6.6-5.2a1 1 0 0 0 0-1.6L4.6 6C3.9 5.5 3 6 3 6.8z"/><path d="M11 6.8v10.4c0 .8.9 1.3 1.6.8l6.6-5.2a1 1 0 0 0 0-1.6L12.6 6c-.7-.5-1.6 0-1.6.8z"/><rect x="19.4" y="5.5" width="2.2" height="13" rx="1.1"/></svg>',
        flecha: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M5 12h13.5"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/></svg>'
    };
    function ico(n) { return '<span class="ig-ico">' + ICO[n] + '</span>'; }

    P.tarde = function (ms, fn) { if (this.rapido) fn(); else this.timers.push(setTimeout(fn, ms)); };
    P.parar = function () { this.timers.forEach(clearTimeout); this.timers = []; };

    /* ---- la operación: las mismas fichas se mueven de un paso al siguiente (técnica FLIP) ---- */
    P.expr = function (tokens) {
        var fila = this.exprEl, viejos = {}, antes = {}, nuevos = [], nuevosId = {}, quitados = [], self = this;
        var animar = !this.rapido && fila.children.length > 0 && fila.animate;
        [].slice.call(fila.children).forEach(function (c) {
            if (c.classList.contains('fantasma')) { c.remove(); return; }
            viejos[c.dataset.id] = c; antes[c.dataset.id] = c.getBoundingClientRect();
        });
        tokens.forEach(function (t) {
            var c = viejos[t.id];
            if (c) delete viejos[t.id]; else { c = crearFicha(t); nuevosId[t.id] = t; }
            c.className = 'tk tk-' + t.k + (t.rol ? ' rol-' + t.rol : '') + (c.classList.contains('pulso') ? ' pulso' : '') + (c.classList.contains('malo') ? ' malo' : '');
            c.textContent = t.v; c.dataset.id = t.id;
            if (t.hacia) c.dataset.hacia = t.hacia; else delete c.dataset.hacia;
            nuevos.push(c);
        });
        Object.keys(viejos).forEach(function (id) { quitados.push({ el: viejos[id], rect: antes[id] }); });
        fila.innerHTML = '';
        nuevos.forEach(function (c) { fila.appendChild(c); });
        this.fichas = tokens;
        if (!animar) return;
        var filaR = fila.getBoundingClientRect(), despues = {};
        nuevos.forEach(function (c) { despues[c.dataset.id] = c.getBoundingClientRect(); });
        nuevos.forEach(function (c) {
            var id = c.dataset.id, r = despues[id], a = antes[id];
            if (nuevosId[id]) {
                var de = nuevosId[id].de, o = de && antes[de];
                if (o) c.animate([{ transform: 'translate(' + (o.left - r.left) + 'px,' + (o.top - r.top) + 'px) scale(0.7)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' });
                else c.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', delay: 250, fill: 'backwards' });
            } else if (a && (Math.abs(a.left - r.left) > 1 || Math.abs(a.top - r.top) > 1)) {
                c.animate([{ transform: 'translate(' + (a.left - r.left) + 'px,' + (a.top - r.top) + 'px)' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' });
            }
        });
        /* las fichas que sobran (el paréntesis, la operación resuelta) se funden hacia su resultado o se desvanecen */
        quitados.forEach(function (x) {
            var g = x.el, hacia = g.dataset.hacia && despues[g.dataset.hacia];
            g.classList.add('fantasma');
            g.style.left = (x.rect.left - filaR.left) + 'px'; g.style.top = (x.rect.top - filaR.top) + 'px';
            fila.appendChild(g);
            var dx = hacia ? hacia.left - x.rect.left : 0, dy = hacia ? hacia.top - x.rect.top : 0;
            var anim = g.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (hacia ? 0.8 : 0.5) + ')', opacity: 0 }], { duration: hacia ? 1100 : 700, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)', fill: 'forwards' });
            anim.onfinish = function () { g.remove(); };
            self.tarde(1300, function () { if (g.parentNode) g.remove(); });
        });
    };
    P.colorear = function (on) { this.exprEl.classList.toggle('colores', !!on); this.estado.colores = !!on; };
    P.ficha = function (id) { return this.exprEl.querySelector('.tk[data-id="' + id + '"]:not(.fantasma)'); };
    P.pulso = function (ids) { var self = this; ids.forEach(function (id) { var f = self.ficha(id); if (f) { f.classList.remove('pulso'); void f.offsetWidth; f.classList.add('pulso'); } }); };
    P.malo = function (ids) { var self = this; ids.forEach(function (id) { var f = self.ficha(id); if (f) f.classList.add('malo'); }); };
    P.limpiarResaltes = function () {
        [].forEach.call(this.exprEl.querySelectorAll('.pulso, .malo'), function (f) { f.classList.remove('pulso', 'malo'); });
        this.bocadilloEl.classList.remove('ver');
    };
    P.bocadillo = function (txt) { var b = this.bocadilloEl; b.textContent = txt; b.classList.remove('ver'); void b.offsetWidth; b.classList.add('ver'); };
    P.pildoras = function (mal, bien) {
        this.pildorasEl.innerHTML = '<span class="ig-pill mal">✗ Tu respuesta <b>' + mal + '</b></span><span class="ig-pill bien">✓ Correcta <b>' + bien + '</b></span>';
        [].forEach.call(this.pildorasEl.children, function (x, i) { x.style.animationDelay = (i * 350) + 'ms'; x.classList.add('ver'); });
    };

    /* ---- la zona central: las cuentas o la regla (una a la vez, en el mismo sitio) ---- */
    P.centro = function (vista) { this.centroEl.dataset.vista = vista || ''; this.lienzo.classList.toggle('vacio', !vista); };

    P.calculos = function (lineas) {
        var c = this.calcEl;
        c.innerHTML = '';
        lineas.forEach(function (l) { c.appendChild(el('div', 'calc-linea', l)); });
        c.appendChild(el('div', 'calc-marca', ''));
        this.encajarTextos();
    };
    P.verCalculo = function (i) { var l = this.calcEl.children[i]; if (l) l.classList.add('ver'); };
    P.marca = function (ok, texto) {
        var m = this.calcEl.lastElementChild; if (!m) return;
        m.className = 'calc-marca ' + (ok ? 'ok' : 'mal'); m.textContent = (ok ? '✓ ' : '✗ ') + texto;
        void m.offsetWidth; m.classList.add('ver');
    };
    P.insignia = function (html, titulo, sub) {
        this.insEl.innerHTML = '<div class="ins-titulo">' + titulo + '</div><div class="ins-regla">' + html + '</div>' + (sub ? '<div class="ins-sub">' + sub + '</div>' : '');
        this.insEl.className = 'ig-insignia si';
        void this.insEl.offsetWidth; this.insEl.classList.add('ver');
        this.encajarTextos();
    };

    /* ---- medidas: tamaño de la operación y de los textos largos (todo cabe, sin cortes ni scroll) ---- */
    P.encajar = function () {
        var raiz = this.raiz, q = this.q, W = raiz.clientWidth || 300, L = this.lienzo;
        var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        /* la operación más ancha que saldrá (en cualquiera de sus pasos) debe caber a lo ancho */
        var formas = q.estados;
        var med = el('div', 'ig-expr ig-medida'); med.style.fontSize = '100px';
        raiz.appendChild(med);
        var max = 1;
        formas.forEach(function (t) { pintarFila(med, t); max = Math.max(max, med.getBoundingClientRect().width); });
        raiz.removeChild(med);
        var tam = Math.min(3.6 * rem, 0.94 * W * 100 / max);
        L.style.setProperty('--ig-tam', tam.toFixed(1) + 'px');
        this.encajarTextos();
    };
    P.encajarTextos = function () {
        /* cuentas y regla: una sola línea cada una; si no caben a lo ancho se reduce la letra */
        var fit = function (e) {
            e.style.fontSize = '';
            var base = parseFloat(getComputedStyle(e).fontSize) || 16, n = 0;
            while (e.scrollWidth > e.clientWidth + 1 && n++ < 40) e.style.fontSize = (base * (1 - n * 0.025)) + 'px';
        };
        [].forEach.call(this.calcEl.querySelectorAll('.calc-linea'), fit);
        [].forEach.call(this.insEl.querySelectorAll('.ins-regla'), fit);
    };

    /* ---------- ventana (reproductor) ---------- */
    /* La explicación avanza sola de un paso al siguiente. Con ◀ ▶ (o las flechas del teclado, o tocando un punto)
       se salta a otro paso: a partir de ese momento ya NO avanza sola, solo a mano. */
    function mostrar(datos) {
        return new Promise(function (resolve) {
            var previo = document.activeElement;
            var script;
            try { script = preparar(datos); } catch (e) { console.warn('Infografia', e); return Explicacion.mostrar(datos).then(resolve); }
            var beats = script.beats, q = script.q, total = beats.length;

            var velo = el('div', 'dialog-overlay ig-overlay');
            velo.innerHTML =
                '<div class="dialog-box ig-box" role="dialog" aria-modal="true" aria-label="Explicación animada">' +
                    '<button type="button" class="close-x ig-cerrar" aria-label="Cerrar">✕</button>' +
                    '<div class="ig-cabecera"><span class="ig-claqueta">🎬 Explicación</span><span class="ig-voz-estado"></span><div class="ig-puntos"></div></div>' +
                    '<div class="ig-escenario"></div>' +
                    '<div class="ig-subtitulo"></div>' +
                    '<div class="ig-nav">' +
                        '<button type="button" class="btn-secondary ig-atras" aria-label="Paso anterior">' + ico('anterior') + '<span class="ig-txt"> Atrás</span></button>' +
                        '<button type="button" class="btn-secondary ig-pausa" aria-label="Pausar al terminar este paso"></button>' +
                        '<button type="button" class="btn-secondary ig-repetir" aria-label="Repetir este paso">' + ico('repetir') + '<span class="ig-txt"> Repetir</span></button>' +
                        '<button type="button" class="btn-secondary ig-adelante" aria-label="Paso siguiente"><span class="ig-txt">Adelante </span>' + ico('siguiente') + '</button>' +
                    '</div>' +
                    '<div class="dialog-actions ig-acciones"><button type="button" class="btn-primary ig-ok">Saltar ' + ico('saltar') + '</button></div>' +
                '</div>';
            document.body.appendChild(velo);

            var puntos = velo.querySelector('.ig-puntos'), sub = velo.querySelector('.ig-subtitulo'), estadoVoz = velo.querySelector('.ig-voz-estado');
            var botonOk = velo.querySelector('.ig-ok'), botonRep = velo.querySelector('.ig-repetir');
            var botonAtras = velo.querySelector('.ig-atras'), botonAdelante = velo.querySelector('.ig-adelante'), botonPausa = velo.querySelector('.ig-pausa');
            beats.forEach(function (x, k) { var p = el('button', 'ig-punto'); p.type = 'button'; p.dataset.k = k; p.setAttribute('aria-label', 'Ir al paso ' + (k + 1)); puntos.appendChild(p); });

            var cerrado = false, ejecucion = 0, escena = null;
            var idx = 0, manual = false, terminado = false;
            var pausaPedida = false, detenido = false, ultimoVoz = '';     // pausa: se detiene al terminar el paso en curso
            Sonido.mantenerBajo(true);                          // la música se queda baja mientras dura la explicación

            function cerrar() {
                if (cerrado) return;
                cerrado = true; ejecucion++;
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('resize', alRedimensionar);
                if (escena) escena.parar();
                Voz.parar();
                Sonido.mantenerBajo(false);                         // y sube suave al cerrarla
                Sonido.efecto('click');
                velo.classList.add('dialog-out');
                setTimeout(function () { velo.remove(); }, 200);
                if (previo && typeof previo.focus === 'function') previo.focus();
                resolve();
            }

            function pintar(vozTexto) {
                ultimoVoz = vozTexto || '';
                var finTotal = terminado && idx >= total - 1 && !manual;      // solo al acabar la última fase quedan todos como hechos
                [].forEach.call(puntos.children, function (p, k) { p.className = 'ig-punto' + (k < idx || finTotal ? ' hecho' : '') + (k === idx && !finTotal ? ' ahora' : ''); });
                botonAtras.disabled = idx <= 0;
                botonAdelante.disabled = idx >= total - 1;
                botonOk.innerHTML = terminado && idx >= total - 1 ? '¡Entendido! Siguiente ' + ico('flecha') : 'Saltar ' + ico('saltar');
                var etiqueta = detenido ? 'en pausa' : pausaPedida ? 'se parará al terminar este paso' : manual ? 'modo manual' : '';
                estadoVoz.textContent = (vozTexto || '') + (etiqueta ? (vozTexto ? ' · ' : '') + etiqueta : '');
                var seguir = manual || pausaPedida;
                botonPausa.innerHTML = seguir ? ico('seguir') + '<span class="ig-txt"> Seguir</span>' : ico('pausa') + '<span class="ig-txt"> Pausa</span>';
                botonPausa.setAttribute('aria-label', seguir ? 'Seguir con la explicación' : 'Pausar al terminar este paso');
                botonPausa.disabled = idx >= total - 1 && terminado;
            }

            function esperar(ms, yo) { return new Promise(function (ok) { setTimeout(ok, ms); }).then(function () { return yo === ejecucion; }); }

            /* la escena tal como queda justo antes del paso i (los pasos anteriores se aplican de golpe) */
            function construirEscena(hasta) {
                if (escena) escena.parar();
                escena = new Escena(velo.querySelector('.ig-escenario'), q, datos);
                (function (e) { setTimeout(function () { if (escena === e) e.encajar(); }, 450); })(escena);   // otra vez, ya abierta la ventana y con las fuentes cargadas
                escena.rapido = true;
                for (var k = 0; k < hasta; k++) {
                    var x = beats[k];
                    x.anim(escena);
                    if (x.seg) x.voz.forEach(function (sg, qq) { x.seg(escena, qq); });
                }
                escena.limpiarResaltes();
                escena.rapido = false;
                escena.encajar();
            }

            /* muestra el paso i y lo cuenta; devuelve false si se canceló por el camino */
            async function ejecutarPaso(i, yo) {
                var b = beats[i];
                idx = i; terminado = false;
                var conVoz = Voz.estado() === 'lista';
                pintar(conVoz ? '🔊' : (Voz.estado() === 'cargando' ? '⏳ cargando la voz…' : ''));
                sub.classList.remove('ver'); void sub.offsetWidth;
                sub.innerHTML = b.cap; sub.classList.add('ver');
                b.anim(escena);
                if (conVoz) {
                    var ultSeg = -1;
                    await Voz.decir(b.voz, {
                        pausa: PAUSA_FRASE,
                        alFrase: function (fi, tot, dur, seg) {
                            if (yo !== ejecucion || seg === ultSeg) return;
                            ultSeg = seg;
                            if (b.seg) b.seg(escena, seg, fi, dur);
                        }
                    });
                } else {
                    // sin voz: cada frase dura lo que tardaría en leerse
                    var acumulado = 0;
                    b.voz.forEach(function (x, k) {
                        if (b.seg) { var cuando = acumulado; escena.tarde(cuando, function () { b.seg(escena, k); }); }
                        acumulado += 800 + x.length * 62 + PAUSA_FRASE;
                    });
                    if (!(await esperar(acumulado, yo))) return false;
                }
                return yo === ejecucion;
            }

            /* reproduce desde el paso i; en modo manual se queda en ese paso, si no sigue solo hasta el final */
            async function correr(i, reconstruir) {
                var yo = ++ejecucion;
                Voz.parar();
                if (escena) escena.parar();
                if (reconstruir || !escena) construirEscena(i);
                for (var j = i; j < total; j++) {
                    if (!(await ejecutarPaso(j, yo))) return;
                    terminado = true;
                    if (manual) { pintar(''); return; }                 // a mano: aquí se detiene
                    if (pausaPedida && j < total - 1) { detenido = true; pintar(''); return; }   // pausa: se detiene al terminar el paso
                    if (j < total - 1) {
                        terminado = false; pintar('');
                        if (!(await esperar(PAUSA_PASO, yo))) return;
                    }
                }
                pintar('');
                try { botonOk.focus({ preventScroll: true }); } catch (e) {}
            }

            function ir(i) {
                manual = true; pausaPedida = false; detenido = false;       // desde aquí ya no avanza solo
                i = Math.max(0, Math.min(total - 1, i));
                Sonido.efecto('click');
                correr(i, true);
            }

            function onKey(ev) {
                if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); if (idx > 0) ir(idx - 1); }
                else if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); if (idx < total - 1) ir(idx + 1); }
                else if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); ev.stopPropagation(); pulsarPausa(); }
                else if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); cerrar(); }
            }
            document.addEventListener('keydown', onKey, true);
            function alRedimensionar() { if (escena) escena.encajar(); }
            window.addEventListener('resize', alRedimensionar);
            botonOk.addEventListener('click', cerrar);
            velo.querySelector('.ig-cerrar').addEventListener('click', cerrar);
            botonAtras.addEventListener('click', function () { if (idx > 0) ir(idx - 1); });
            botonAdelante.addEventListener('click', function () { if (idx < total - 1) ir(idx + 1); });
            botonRep.addEventListener('click', function () { ir(idx); });
            /* Pausa: no corta el paso en curso, pero al terminarlo no pasa al siguiente. «Seguir» reanuda en automático */
            function pulsarPausa() {
                if (botonPausa.disabled) return;
                Sonido.efecto('click');
                if (!manual && !pausaPedida) { pausaPedida = true; pintar(ultimoVoz); return; }          // pedir pausa
                if (pausaPedida && !detenido && !manual) { pausaPedida = false; pintar(ultimoVoz); return; }   // arrepentirse
                var sig = terminado ? idx + 1 : idx;                                                       // reanudar
                manual = false; pausaPedida = false; detenido = false;
                if (sig < total) correr(sig, !terminado); else pintar('');
            }
            botonPausa.addEventListener('click', pulsarPausa);
            puntos.addEventListener('click', function (ev) { var p = ev.target.closest('.ig-punto'); if (p) ir(parseInt(p.dataset.k, 10)); });

            correr(0, true);
        });
    }

    return { mostrar: mostrar, preparar: preparar, guion: guion };

})();
