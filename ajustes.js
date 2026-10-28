/* =========================================================
   Ajustes · ventana de opciones (rueda dentada de la pantalla de inicio)
   - Música y efectos: los guarda sonido.js
   - Fondo animado: lo guarda fondo.js
   - Modo ligero: lo gestiona rendimiento.js · Escala fija: escala.js · Voz y explicaciones: voz-ui.js
   ========================================================= */
(function () {

    var modal = document.getElementById('settings-modal');
    var botonMusica = document.getElementById('music-toggle-button');
    var botonEfectos = document.getElementById('sfx-toggle-button');
    var fondos = [].slice.call(document.querySelectorAll('#bg-seg button'));

    function pintar() {
        botonMusica.setAttribute('aria-pressed', String(Sonido.musicaActiva()));
        botonEfectos.setAttribute('aria-pressed', String(Sonido.efectosActivos()));
        fondos.forEach(function (b) { b.classList.toggle('selected', b.dataset.fondo === Fondo.tipo()); });
    }
    pintar();

    /* Si las opciones no caben a lo alto (escala fija grande, ventana baja), el contenido se reduce lo justo para que quepa entero.
       Se calcula de una vez a partir del alto natural (siempre el mismo resultado) y se aplica antes de que la ventana termine de entrar:
       así no hay «rebotes» de tamaño. */
    function ajustar() {
        var panel = modal.querySelector('.panel-opciones'), cont = panel && panel.querySelector('.panel-contenido');
        if (!cont || modal.classList.contains('hidden')) return;
        cont.style.zoom = 1;
        var ms = getComputedStyle(modal), ps = getComputedStyle(panel);
        var libre = modal.clientHeight - parseFloat(ms.paddingTop) - parseFloat(ms.paddingBottom);
        var marco = parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom) + parseFloat(ps.borderTopWidth) + parseFloat(ps.borderBottomWidth);
        var z = Math.min(1, (libre - marco - 12) / cont.offsetHeight);           // offsetHeight no cambia con la animación de entrada
        cont.style.zoom = Math.max(0.4, Math.floor(z * 50) / 50).toFixed(2);                            // sin iterar y a saltos de 0,02: diferencias de un píxel no cambian el tamaño
    }
    window.ajustarOpciones = ajustar;
    window.addEventListener('resize', ajustar);
    modal.addEventListener('click', function () { setTimeout(ajustar, 0); });          // al cambiar un ajuste puede cambiar el alto (textos de ayuda)

    function abrir() { Sonido.efecto('click'); abrirModal(modal); ajustar(); }
    function cerrar() { cerrarModal(modal); }          // con animación de salida (efectos.js)

    document.getElementById('settings-button').addEventListener('click', abrir);
    modal.querySelector('.close-x').addEventListener('click', function () { Sonido.efecto('click'); cerrar(); });
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) cerrar(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrar();
    });

    botonMusica.addEventListener('click', function () { Sonido.alternarMusica(); pintar(); Sonido.efecto('click'); });
    botonEfectos.addEventListener('click', function () { Sonido.alternarEfectos(); pintar(); Sonido.efecto('click'); });
    fondos.forEach(function (b) { b.addEventListener('click', function () { Fondo.set(b.dataset.fondo); pintar(); Sonido.efecto('click'); }); });
    document.getElementById('perf-toggle-button').addEventListener('click', function () {
        Sonido.efecto('click');
        setTimeout(Fondo.recrear, 0);
    });
    document.getElementById('scale-toggle-button').addEventListener('click', function () { Sonido.efecto('click'); });

})();
