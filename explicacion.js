/* =========================================================
   Explicación escrita (cuando «Explicación con voz» está desactivada, o si la voz falla)
   Usa EXACTAMENTE los mismos textos que la animada: cada paso es el subtítulo (cap) de un paso de Infografia.guion().
   Explicacion.mostrar(datos) → promesa que se resuelve al cerrarla (mismos datos que Infografia.mostrar)
   ========================================================= */
window.Explicacion = (function () {

    function mostrar(datos) {
        return new Promise(function (resolve) {
            var previo = document.activeElement;
            var g = Infografia.guion(datos), q = g.q;
            // el primer paso («Vamos a mirar…») ya lo dice la cabecera con la operación grande
            var pasos = g.beats.slice(1).map(function (b) { return '<li>' + b.cap + '</li>'; }).join('');
            var velo = document.createElement('div');
            velo.className = 'dialog-overlay';
            velo.innerHTML =
                '<div class="dialog-box ex-box" role="dialog" aria-modal="true" aria-label="Explicación">' +
                    '<div class="ex-cabecera"><div class="dialog-icon">🤔</div><h3 class="ex-titulo">Vamos a verlo</h3>' +
                    '<div class="ex-expr">' + Op.texto(q.tokens) + '</div></div>' +
                    '<ol class="ex-pasos">' + pasos + '</ol>' +
                    '<div class="ex-regla">' + Op.regla() + '</div>' +
                    '<div class="dialog-actions"><button type="button" class="btn-primary ex-ok">¡Entendido! Siguiente ➜</button></div>' +
                '</div>';
            document.body.appendChild(velo);
            /* si el texto no cabe en la pantalla (móvil pequeño, letra grande), se reduce hasta que quepa: nunca hay scroll */
            var caja = velo.querySelector('.ex-box'), hijos = [].slice.call(caja.children);
            function ajustar() {
                var z = 1; hijos.forEach(function (e) { e.style.zoom = 1; });
                while (caja.scrollHeight > caja.clientHeight + 1 && z > 0.4) { z -= 0.03; hijos.forEach(function (e) { e.style.zoom = z.toFixed(2); }); }
            }
            ajustar(); setTimeout(ajustar, 350);
            var cerrado = false;
            function cerrar() {
                if (cerrado) return;
                cerrado = true;
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('resize', ajustar);
                if (window.Sonido) Sonido.efecto('click');
                velo.classList.add('dialog-out');
                setTimeout(function () { velo.remove(); }, 200);
                if (previo && typeof previo.focus === 'function') previo.focus();
                resolve();
            }
            function onKey(ev) { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); cerrar(); } }
            document.addEventListener('keydown', onKey, true);
            window.addEventListener('resize', ajustar);
            velo.querySelector('.ex-ok').addEventListener('click', cerrar);
            setTimeout(function () { var b = velo.querySelector('.ex-ok'); if (b && !cerrado) b.focus({ preventScroll: true }); }, 50);
        });
    }

    return { mostrar: mostrar };

})();
