/* =========================================================
   Arrastre · actividad «Arrastrar»: se resuelve el primer paso de la operación y se monta lo que queda
   - Con ratón y con el dedo (eventos de puntero; las piezas llevan touch-action: none para que la página no se desplace).
   - También se puede TOCAR una pieza (queda marcada) y luego tocar un hueco.
   - Las piezas de la bandeja son infinitas (los valores se repiten si hacen falta): al arrastrarlas se copian.
   - Una pieza colocada se puede arrastrar a otro hueco, o fuera de los huecos para quitarla (o tocarla).
   - Hay DOS clases de hueco y de pieza: número (blanco) y operación + − × ÷ (violeta). Cada pieza solo cabe en su clase
     de hueco: el hueco de operación es violeta para que se vea que ahí no va un número.

   Arrastre.montar(contenedor, op, plantilla, alCambiar) → { valores(), borrar(), marcar(ok), pedirHuecos(), destruir() }
     plantilla = Op.plantillaArrastre(op): { tipo: 'paso', huecos: N, forma: [{k:'n'|'o'|'p', v?}], bandeja: [números] }
     paso:  = ▢ [op] ▢ …   lo que queda tras el primer paso: un hueco por cada número y operación, en orden;
            los paréntesis que quedan ya vienen puestos (no se mueven)
   ========================================================= */
window.Arrastre = (function () {

    function el(tag, cls, html) { var x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }

    function montar(cont, op, pl, alCambiar) {
        var valores = [], huecos = [];
        var raiz = el('div', 'arrastre'), plantilla = el('div', 'plantilla'), bandeja = el('div', 'bandeja');
        plantilla.appendChild(el('span', 'igual', '='));

        // tipo: 'n' número · 'o' operación (+ − × ÷, todas valen en el mismo hueco: elegir la buena es parte del ejercicio)
        function hueco(i, tipo) {
            var h = el('span', 'hueco' + (tipo === 'n' ? '' : ' op'));
            h.dataset.i = i; h.dataset.tipo = tipo;
            huecos[i] = h; valores[i] = null;
            plantilla.appendChild(h);
        }
        // plantilla del paso: = ▢ [op] ▢ …   (lo que queda después de resolver el primer paso)
        var siguienteHueco = 0;
        pl.forma.forEach(function (f) {
            if (f.k === 'p') plantilla.appendChild(el('span', 'tk tk-p', f.v));
            else hueco(siguienteHueco++, f.k);
        });
        if (pl.forma.length > 3) plantilla.classList.add('larga');

        pl.bandeja.forEach(function (n) { var p = el('button', 'pieza', String(n)); p.type = 'button'; p.dataset.v = n; p.dataset.tipo = 'n'; bandeja.appendChild(p); });
        ['×', '+', '−', '÷'].forEach(function (o) { var p = el('button', 'pieza op', o); p.type = 'button'; p.dataset.v = o; p.dataset.tipo = 'o'; bandeja.appendChild(p); });

        var ayuda = el('div', 'ayuda-arrastre', 'Resuelve el primer paso y arrastra (o toca) lo que queda: los números en los blancos y las operaciones (+ − × ÷) en los <b>violeta</b>');
        var acciones = el('div', 'acciones-arrastre', '<button type="button" class="btn-secondary" data-acc="borrar">Borrar</button><button type="button" class="btn-primary" data-acc="comprobar">Comprobar ✔</button>');
        raiz.appendChild(plantilla); raiz.appendChild(bandeja); raiz.appendChild(ayuda); raiz.appendChild(acciones);
        cont.appendChild(raiz);

        var seleccion = null, arr = null;      // pieza marcada con un toque · arrastre en curso

        function cambiado() { if (alCambiar) alCambiar(valores.slice()); }
        function poner(i, v) {
            var h = huecos[i]; valores[i] = v;
            h.textContent = v == null ? '' : v;
            h.classList.toggle('lleno', v != null);
            h.classList.remove('ok', 'mal', 'pide');
            cambiado();
        }
        function marcaSel(p) {
            [].forEach.call(bandeja.querySelectorAll('.pieza'), function (x) { x.classList.toggle('sel', x === p); });
            seleccion = p || null;
        }
        function sacude(h) { h.classList.remove('pide'); void h.offsetWidth; h.classList.add('pide'); }

        /* hueco compatible más cercano al puntero (con un margen, para el dedo) */
        function huecoBajo(x, y, tipo) {
            var mejor = null, dm = 1e9;
            huecos.forEach(function (h) {
                if (h.dataset.tipo !== tipo) return;
                var r = h.getBoundingClientRect(), m = Math.max(r.width, r.height) * 0.35;
                if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) return;
                var d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
                if (d < dm) { dm = d; mejor = h; }
            });
            return mejor;
        }

        function empezar(e, origen, valor, tipo, desde) {
            arr = { origen: origen, valor: valor, tipo: tipo, desde: desde, x0: e.clientX, y0: e.clientY, mov: false, flota: null, sobre: null, id: e.pointerId };
            try { origen.setPointerCapture(e.pointerId); } catch (er) {}
        }
        function mover(e) {
            if (!arr || e.pointerId !== arr.id) return;
            if (!arr.mov && Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 6) {
                arr.mov = true;
                var cs = getComputedStyle(arr.origen), r = arr.origen.getBoundingClientRect();
                var f = el('div', 'pieza-flota', arr.valor);
                f.style.fontSize = cs.fontSize; f.style.width = r.width + 'px'; f.style.height = r.height + 'px';
                document.body.appendChild(f); arr.flota = f;
                document.documentElement.classList.add('arrastre-en-curso');
                if (arr.desde != null) arr.origen.classList.add('agarrada'); else arr.origen.classList.add('agarrada');
                marcaSel(null);
            }
            if (!arr.mov) return;
            e.preventDefault();
            arr.flota.style.left = e.clientX + 'px'; arr.flota.style.top = e.clientY + 'px';
            var h = huecoBajo(e.clientX, e.clientY, arr.tipo);
            if (h !== arr.sobre) { if (arr.sobre) arr.sobre.classList.remove('sobre'); arr.sobre = h; if (h) h.classList.add('sobre'); }
        }
        function soltar(e) {
            if (!arr || e.pointerId !== arr.id) return;
            var a = arr; arr = null;
            try { a.origen.releasePointerCapture(a.id); } catch (er) {}
            if (a.flota) a.flota.remove();
            document.documentElement.classList.remove('arrastre-en-curso');
            a.origen.classList.remove('agarrada');
            if (a.sobre) a.sobre.classList.remove('sobre');
            if (a.mov) {
                var h = a.sobre;
                if (h) {
                    var i = parseInt(h.dataset.i, 10);
                    if (a.desde != null && a.desde !== i) poner(a.desde, null);
                    poner(i, a.valor);
                } else if (a.desde != null) poner(a.desde, null);          // arrastrada fuera de los huecos: se quita
                if (window.Sonido) Sonido.efecto('click', 0.5);
                return;
            }
            // un toque (sin arrastrar)
            if (a.desde != null) { poner(a.desde, null); if (window.Sonido) Sonido.efecto('click', 0.4); return; }
            marcaSel(seleccion === a.origen ? null : a.origen);
            if (window.Sonido) Sonido.efecto('click', 0.4);
        }

        raiz.addEventListener('pointerdown', function (e) {
            var p = e.target.closest('.pieza'), h = e.target.closest('.hueco');
            if (p && bandeja.contains(p)) { empezar(e, p, p.dataset.v, p.dataset.tipo, null); return; }
            if (h && h.classList.contains('lleno')) { empezar(e, h, valores[parseInt(h.dataset.i, 10)], h.dataset.tipo, parseInt(h.dataset.i, 10)); return; }
            if (h && seleccion) {            // toque en un hueco vacío con una pieza marcada
                if (h.dataset.tipo !== seleccion.dataset.tipo) { sacude(h); return; }
                poner(parseInt(h.dataset.i, 10), seleccion.dataset.v);
                marcaSel(null);
                if (window.Sonido) Sonido.efecto('click', 0.5);
            }
        });
        raiz.addEventListener('pointermove', mover);
        raiz.addEventListener('pointerup', soltar);
        raiz.addEventListener('pointercancel', soltar);
        // los botones de Borrar / Comprobar los atiende app.js (data-acc)

        return {
            valores: function () { return valores.slice(); },
            borrar: function () { marcaSel(null); huecos.forEach(function (h, i) { poner(i, null); }); },
            marcar: function (ok) { huecos.forEach(function (h) { h.classList.remove('ok', 'mal'); h.classList.add(ok ? 'ok' : 'mal'); }); },
            pedirHuecos: function () { huecos.forEach(function (h, i) { if (valores[i] == null) sacude(h); }); },
            lleno: function () { return valores.every(function (v) { return v != null; }); },
            destruir: function () { if (arr && arr.flota) arr.flota.remove(); document.documentElement.classList.remove('arrastre-en-curso'); }
        };
    }

    return { montar: montar };

})();
