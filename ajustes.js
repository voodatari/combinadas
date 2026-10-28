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

    /* Si las opciones no caben a lo alto (escala fija grande, ventana baja), el contenido se reduce un poco hasta que quepa: nunca se corta */
    function ajustar() {
        var panel = modal.querySelector('.panel-opciones'), cont = panel && panel.querySelector('.panel-contenido');
        if (!cont || modal.classList.contains('hidden')) return;
        cont.style.zoom = 1;
        var z = 1;
        while (panel.scrollHeight > panel.clientHeight + 1 && z > 0.4) { z -= 0.03; cont.style.zoom = z.toFixed(2); }
        if (z < 1) cont.style.zoom = Math.max(0.4, z - 0.03).toFixed(2);       // un poco de margen: el límite exacto es inestable
    }
    window.ajustarOpciones = ajustar;
    window.addEventListener('resize', ajustar);
    modal.addEventListener('click', function () { setTimeout(ajustar, 0); });          // al cambiar un ajuste puede cambiar el alto (textos de ayuda)

    function abrir() { Sonido.efecto('click'); abrirModal(modal); ajustar(); setTimeout(ajustar, 350); }
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
