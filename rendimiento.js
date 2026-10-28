/* =========================================================
   Rendimiento · modo ligero para equipos modestos
   El desenfoque (backdrop-filter de las ventanas y la sombra
   difusa de los números del fondo) se recalcula en cada fotograma
   sobre un fondo animado: en un portátil con gráfica integrada es
   lo que más cuesta. En modo ligero (<html class="ligero">) se quita.

   Se activa solo si el equipo parece modesto (misma detección que
   en Juegos de aula); el interruptor ⚡ lo cambia a mano y la
   elección se guarda.
   Se carga en el <head> para que la clase esté puesta antes de pintar.
   ========================================================= */
window.Rendimiento = (function (global) {

    var K_LIGERO = 'combinadas.ligero';   // '1' / '0' · sin guardar = automático

    function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) {
        try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    }

    /* ---------- ¿Equipo modesto? ---------- */
    function nombreGrafica() {
        try {
            var c = document.createElement('canvas');
            var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            if (!gl) return '';
            var ext = gl.getExtension('WEBGL_debug_renderer_info');
            var n = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            var perder = gl.getExtension('WEBGL_lose_context');
            if (perder) perder.loseContext();
            return String(n || '');
        } catch (e) { return ''; }
    }

    function detectar() {
        var motivos = [];
        var hilos = navigator.hardwareConcurrency || 0;
        if (hilos && hilos <= 4) motivos.push('CPU de ' + hilos + ' hilos');
        var mem = navigator.deviceMemory;
        if (mem && mem <= 4) motivos.push(mem + ' GB de memoria');
        var gpu = nombreGrafica();
        var discreta = /nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|radeon r9|arc a\d/i.test(gpu);
        var integrada = !discreta &&
            /intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|radeon vega|vega \d|mali|adreno|powervr|llvmpipe|swiftshader|basic render/i.test(gpu);
        var dpr = global.devicePixelRatio || 1;
        var pixeles = (screen.width * dpr) * (screen.height * dpr);
        if (integrada && pixeles >= 3.6e6) motivos.push('gráfica integrada con pantalla grande');
        return {
            modesto: motivos.length > 0,
            motivos: motivos,
            hilos: hilos,
            gpu: gpu,
            pantalla: Math.round(screen.width * dpr) + '×' + Math.round(screen.height * dpr)
        };
    }

    var deteccion = detectar();
    var guardado = leer(K_LIGERO);
    var ligero = guardado === null ? deteccion.modesto : guardado === '1';

    function aplicar() {
        document.documentElement.classList.toggle('ligero', ligero);
        var b = document.getElementById('perf-toggle-button');
        if (b) {
            b.setAttribute('aria-pressed', String(ligero));
            b.title = ligero
                ? 'Modo ligero activado: sin desenfoque. Pulsa para volver a los efectos completos.'
                : 'Pulsa para quitar el desenfoque si el juego va lento.';
        }
    }
    aplicar();

    function conectarBoton() {
        var b = document.getElementById('perf-toggle-button');
        if (!b) return;
        b.addEventListener('click', function () {
            ligero = !ligero;
            escribir(K_LIGERO, ligero ? '1' : '0');
            aplicar();
        });
        aplicar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', conectarBoton);
    else conectarBoton();

    return {
        deteccion: deteccion,
        ligero: function () { return ligero; },
        volverAutomatico: function () {
            escribir(K_LIGERO, null);
            ligero = deteccion.modesto;
            aplicar();
            return ligero;
        }
    };

})(window);
