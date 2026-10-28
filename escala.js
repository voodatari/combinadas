/* =========================================================
   Escala · el juego se ve igual con cualquier escala de pantalla
   1) Ordenadores: con la escala de Windows al 125 % o al 150 %, el navegador
      solo tiene 1536 o 1280 px de ancho (y menos alto) en lugar de 1920.
      Con <html class="escala-fija"> el tamaño base (1 rem) se amplía o reduce
      para ocupar la misma proporción de pantalla que en un monitor 1080p al
      100 %, algo ampliado para verse bien en el aula (referencia: 1500×720).
      Todo el CSS está en rem, así que el juego entero escala a la vez.
   2) Móviles y tabletas pequeñas (<html class="movil">): Safari de iOS puede
      mostrar la página en una pantalla virtual más ancha que el teléfono (zoom
      de página por debajo del 100 %, o «encoger para ajustar»), y entonces todo
      sale diminuto y sin los estilos de móvil. Se compara el ancho de la
      ventana con el de la pantalla física y se compensa con el tamaño base.
   3) Clases de diseño (las pone este archivo y NO los @media, que no se cumplen
      con la ventana virtual de Safari; así el CSS móvil se escribe una sola vez):
        html.estrecho → ancho efectivo ≤ 700 px de referencia (móvil o ventana estrecha)
        html.corta    → alto efectivo < 650 px de referencia
      y la variable --alto = alto VISIBLE real (innerHeight, sin la barra de Safari).
   Se carga en el <head> para que las clases estén puestas antes de pintar.
   ========================================================= */
window.Escala = (function (global) {

    var K_ESCALA = 'combinadas.escala';   // '1' / '0' · sin guardar = activada
    var REF_ANCHO = 1500, REF_ALTO = 720;
    var MIN = 0.5, MAX = 2, ANCHO_MINIMO = 900;
    var ESTRECHO = 700, CORTA = 650;

    function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    var activa = leer(K_ESCALA) !== '0';

    /* ¿Teléfono o tableta pequeña? Ancho de su pantalla física en px CSS «normales» */
    function dispositivo() {
        var tactil = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in global;
        var w = (global.screen && screen.width) || 0, h = (global.screen && screen.height) || 0;
        var corto = Math.min(w, h), largo = Math.max(w, h);
        var horizontal = global.innerWidth > global.innerHeight;
        return { movil: tactil && corto > 0 && corto <= 600, ancho: horizontal ? largo : corto };
    }

    /* >1 si la página está en una pantalla virtual más ancha que el teléfono */
    function compensacion() {
        var d = dispositivo();
        if (!d.movil || !d.ancho) return 1;
        var r = global.innerWidth / d.ancho;
        return r > 1.15 ? Math.min(2.2, Math.round(r * 100) / 100) : 1;
    }

    function calcular() {
        var w = global.innerWidth, h = global.innerHeight;
        if (w < ANCHO_MINIMO) return 1;
        var z = Math.min(w / REF_ANCHO, h / REF_ALTO);
        return Math.round(Math.min(MAX, Math.max(MIN, z)) * 100) / 100;
    }

    function factor() {
        var c = compensacion();
        if (c > 1) return c;                       // el móvil siempre se corrige
        return activa && !dispositivo().movil ? calcular() : 1;
    }

    function aplicar() {
        var raiz = document.documentElement, f = factor();
        raiz.classList.toggle('movil', dispositivo().movil);
        raiz.classList.toggle('escala-fija', f !== 1);
        raiz.classList.toggle('estrecho', global.innerWidth / f <= ESTRECHO);
        raiz.classList.toggle('corta', global.innerHeight / f < CORTA);
        raiz.style.setProperty('--escala', String(f));
        raiz.style.setProperty('--alto', global.innerHeight + 'px');       // alto visible real (Safari: sin la barra inferior)
        var b = document.getElementById('scale-toggle-button');
        if (b) {
            b.setAttribute('aria-pressed', String(activa));
            var nota = document.getElementById('scale-toggle-info');
            if (nota) nota.textContent = activa
                ? 'Activada · ahora al ' + Math.round(f * 100) + ' %'
                : 'Mismo aspecto con cualquier escala';
        }
    }
    aplicar();

    function conectarBoton() {
        var b = document.getElementById('scale-toggle-button');
        if (!b) return;
        b.addEventListener('click', function () {
            activa = !activa;
            escribir(K_ESCALA, activa ? '1' : '0');
            aplicar();
            global.dispatchEvent(new Event('resize'));
        });
        aplicar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', conectarBoton);
    else conectarBoton();

    global.addEventListener('resize', aplicar);
    global.addEventListener('orientationchange', function () { setTimeout(aplicar, 250); });

    return {
        activa: function () { return activa; },
        factor: factor,
        movil: function () { return dispositivo().movil; }
    };

})(window);
