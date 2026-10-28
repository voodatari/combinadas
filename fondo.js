/* =========================================================
   Fondo animado · con el tema del juego
   - numeros : cifras y signos (× + − ( ) =) que flotan como tiza en un cuaderno
   - puntos  : cuadrículas de puntos de dos colores que se separan y se vuelven a juntar
   En modo ligero usa menos elementos; se pausa si la pestaña no se ve.
   Fondo.set('numeros' | 'puntos' | 'none')
   ========================================================= */
window.Fondo = (function () {

    var K_FONDO = 'combinadas.fondo';
    function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    var TIPOS = ['numeros', 'puntos', 'none'];
    var tipo = leer(K_FONDO);
    if (TIPOS.indexOf(tipo) < 0) tipo = 'numeros';      // por defecto: números

    var SIGNOS = ['×', '+', '−', '(', ')', '=', '÷', '+'];
    var AMARILLO = 'rgba(255, 210, 63, ', AZUL = 'rgba(90, 169, 255, ', CORAL = 'rgba(255, 138, 91, ', TIZA = 'rgba(232, 240, 255, ';

    var canvas, ctx, ancho = 0, alto = 0, tiempo = 0, raf = null, ultimo = 0;
    var glifos = [], mallas = [];

    function ligero() { return window.Rendimiento && Rendimiento.ligero(); }
    function movil() { return document.documentElement.classList.contains('movil'); }
    function azar(a, b) { return a + Math.random() * (b - a); }

    /* ---------- cifras y signos flotando ---------- */
    function nuevoGlifo(inicial) {
        var r = Math.random(), texto, tam, color;
        if (r < 0.5) { texto = String(2 + Math.floor(Math.random() * 8)); tam = azar(40, 96); color = [AMARILLO, AZUL, CORAL][Math.floor(Math.random() * 3)]; }
        else { texto = SIGNOS[Math.floor(Math.random() * SIGNOS.length)]; tam = azar(46, 110); color = TIZA; }
        return {
            t: texto, tam: tam, c: color,
            x: Math.random() * ancho, y: inicial ? Math.random() * alto : alto + tam,
            vy: -azar(0.12, 0.42), vx: azar(-0.12, 0.12), rot: azar(-0.4, 0.4), vr: azar(-0.003, 0.003),
            a: azar(0.07, 0.17), f: Math.random() * 6
        };
    }

    function pintarNumeros() {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (var i = 0; i < glifos.length; i++) {
            var g = glifos[i];
            g.x += g.vx + Math.sin(tiempo * 0.6 + g.f) * 0.15; g.y += g.vy; g.rot += g.vr;
            if (g.y < -g.tam * 1.5) { glifos[i] = nuevoGlifo(false); continue; }
            ctx.save();
            ctx.translate(g.x, g.y); ctx.rotate(g.rot);
            ctx.font = '700 ' + g.tam + 'px Andika, sans-serif';
            ctx.fillStyle = g.c + g.a + ')';
            ctx.fillText(g.t, 0, 0);
            ctx.restore();
        }
    }

    /* ---------- cuadrículas de puntos que se reparten ---------- */
    function nuevaMalla(inicial) {
        var filas = 2 + Math.floor(Math.random() * 4), c1 = 2 + Math.floor(Math.random() * 4), c2 = 2 + Math.floor(Math.random() * 4);
        return {
            filas: filas, c1: c1, c2: c2, paso: azar(13, 19),
            x: Math.random() * ancho, y: inicial ? Math.random() * alto : alto + 120,
            vy: -azar(0.1, 0.3), vx: azar(-0.08, 0.08), f: Math.random() * 6, a: azar(0.13, 0.24),
            col: Math.random() < 0.5 ? [AZUL, CORAL] : [AMARILLO, AZUL]
        };
    }

    function pintarPuntos() {
        for (var i = 0; i < mallas.length; i++) {
            var m = mallas[i];
            m.x += m.vx; m.y += m.vy;
            var anchoTotal = (m.c1 + m.c2) * m.paso + 40;
            if (m.y < -m.filas * m.paso - 40) { mallas[i] = nuevaMalla(false); continue; }
            var sep = (Math.sin(tiempo * 0.55 + m.f) + 1) / 2 * m.paso * 1.8;      // se separan y se vuelven a juntar
            var x0 = m.x - anchoTotal / 2;
            for (var f = 0; f < m.filas; f++) {
                for (var c = 0; c < m.c1 + m.c2; c++) {
                    var primero = c < m.c1;
                    ctx.fillStyle = m.col[primero ? 0 : 1] + m.a + ')';
                    ctx.beginPath();
                    ctx.arc(x0 + c * m.paso + (primero ? 0 : sep), m.y + f * m.paso, m.paso * 0.26, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    /* ---------- bucle ---------- */
    function crear() {
        glifos = []; mallas = [];
        var n = ligero() || movil() ? 12 : 26;
        for (var i = 0; i < n; i++) glifos.push(nuevoGlifo(true));
        var m = ligero() || movil() ? 5 : 10;
        for (var j = 0; j < m; j++) mallas.push(nuevaMalla(true));
    }

    function medir() {
        ancho = canvas.width = window.innerWidth;
        alto = canvas.height = window.innerHeight;
        crear();
    }

    var cuadro = 0;
    function bucle(ahora) {
        raf = null;
        if (document.hidden || tipo === 'none') { ctx.clearRect(0, 0, ancho, alto); return; }
        var dt = Math.min(0.05, (ahora - (ultimo || ahora)) / 1000);
        ultimo = ahora;
        tiempo += dt;
        cuadro++;
        // en el móvil, un fotograma de cada dos
        if (!(movil() && cuadro % 2)) {
            ctx.clearRect(0, 0, ancho, alto);
            if (tipo === 'numeros') pintarNumeros(); else pintarPuntos();
        }
        raf = requestAnimationFrame(bucle);
    }

    function arrancar() { ultimo = 0; if (!raf && tipo !== 'none') raf = requestAnimationFrame(bucle); }

    function iniciar() {
        canvas = document.getElementById('bg-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        medir();
        window.addEventListener('resize', medir);
        document.addEventListener('visibilitychange', arrancar);
        arrancar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();

    return {
        tipo: function () { return tipo; },
        set: function (t) {
            if (TIPOS.indexOf(t) < 0) return;
            tipo = t;
            escribir(K_FONDO, t);
            if (ctx) { ctx.clearRect(0, 0, ancho, alto); arrancar(); }
        },
        recrear: function () { if (ctx) crear(); }
    };

})();
