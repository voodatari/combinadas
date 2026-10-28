/* =========================================================
   MusicaBucle · música en bucle sin cortes
   Con <audio loop>, Chrome deja una pequeña pausa cada vez que la pista
   vuelve a empezar (no recorta el relleno que el codificador añade a los
   MP3 y el salto al principio no es instantáneo). Firefox lo hace
   perfecto, así que allí se usa el <audio loop> de siempre.
   En los demás, la pista se decodifica con Web Audio y se repite muestra
   a muestra. Para que ya la primera vuelta vaya sin cortes, la música
   espera a que la pista esté lista (como mucho ESPERA ms); si tarda más,
   suena el <audio> y al acabar esa vuelta entra el bucle sin cortes.
   Si algo falla, se queda con el <audio loop>.
   Las pistas en OGG (sin relleno de codificador) se repiten enteras, sin recortar nada.

   Se maneja como un <audio> en bucle: play(), pause(), volume, paused y
   currentTime. Al pausar recuerda por dónde iba y play() sigue desde ahí.
   Opciones:
     sinCortes: false  → siempre <audio loop> (pistas muy largas: decodificadas
                         ocuparían mucha memoria y el corte casi no se oye)
     liberar: true     → al pausar suelta la pista decodificada (ahorra memoria;
                         al volver a sonar se prepara otra vez)
   ========================================================= */
window.MusicaBucle = (function () {

  var ESPERA = 1500;
  var ACTIVO = !/firefox/i.test(navigator.userAgent) && !!(window.AudioContext || window.webkitAudioContext);
  var ctx = null;

  function contexto() {
    if (!ACTIVO) return null;
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    return ctx;
  }

  /* El navegador no deja sonar hasta el primer toque: entonces se despierta */
  function despertar() {
    if (ctx && ctx.state === 'suspended') { var r = ctx.resume(); if (r && r.catch) r.catch(function () {}); }
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, despertar, true); });      // iOS: solo arranca dentro de touchend / click

  /* Como el play() de un <audio>: falla si el navegador aún no deja sonar,
     para que quien llama sepa que tiene que esperar a un toque */
  function reanudar() {
    if (ctx.state === 'running') return Promise.resolve();
    return new Promise(function (ok, mal) {
      var t = setTimeout(function () { mal(new DOMException('Hace falta un toque para que suene', 'NotAllowedError')); }, 300);
      ctx.resume().then(function () { clearTimeout(t); ok(); }, function (e) { clearTimeout(t); mal(e); });
    });
  }

  /* Recorta solo el silencio digital de los extremos (el relleno del
     codificador, unos 50 ms como mucho): los silencios de la música no se tocan */
  function limites(buffer) {
    var tope = Math.min(2304, Math.floor(buffer.length / 4)), canales = [];
    for (var c = 0; c < buffer.numberOfChannels; c++) canales.push(buffer.getChannelData(c));
    function mudo(i) { return canales.every(function (d) { return Math.abs(d[i]) < 1e-4; }); }
    var ini = 0, fin = buffer.length;
    while (ini < tope && mudo(ini)) ini++;
    while (buffer.length - fin < tope && mudo(fin - 1)) fin--;
    return [ini / buffer.sampleRate, fin / buffer.sampleRate];
  }

  function MusicaBucle(src, op) {
    op = op || {};
    this.el = new Audio(src);
    this.el.loop = true;
    this.el.preload = op.preload || 'none';
    this.src = this.el.src;
    this.vol = 1;
    this.parado = true;
    this.liberar = !!op.liberar;
    this.webAudio = op.sinCortes !== false && !!contexto();
    this.buffer = null;
    this.decodificando = false;
    this.lim = [0, 0];
    this.fuente = null;
    this.ganancia = null;
    this.inicio = 0;       // reloj de Web Audio en que la pista estaba en lim[0]
    this.offset = 0;       // por dónde seguir al volver a sonar
    this.espera = null;    // esperando la pista decodificada para empezar sin cortes
  }
  var P = MusicaBucle.prototype;

  P.decodificar = function () {
    if (!this.webAudio || this.buffer || this.decodificando) return;
    this.decodificando = true;
    var self = this;
    fetch(this.src)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (d) { return ctx.decodeAudioData(d); })
      .then(function (b) { self.decodificando = false; self.listo(b); }, function () {
        /* sin bucle perfecto: <audio loop> (si estaba esperando, ya) */
        self.decodificando = false;
        self.webAudio = false;
        if (self.espera) { clearTimeout(self.espera); self.espera = null; if (!self.parado) self.tocarElemento(); }
      });
  };

  P.tocarElemento = function () {
    try { if (Math.abs(this.el.currentTime - this.offset) > 0.3) this.el.currentTime = this.offset; } catch (e) {}
    var p = this.el.play();
    if (p && p.catch) p.catch(function () {});
    return p;
  };

  P.listo = function (buffer) {
    this.buffer = buffer;
    /* Solo los MP3 llevan relleno del codificador que recortar. Los OGG (y cualquier otro formato sin relleno) se repiten ENTEROS,
       de la primera a la última muestra: así el punto de bucle es exactamente el que preparó quien hizo la pista. */
    this.lim = /\.mp3(\?|$)/i.test(this.src) ? limites(buffer) : [0, buffer.length / buffer.sampleRate];
    if (this.parado) { if (this.liberar) this.buffer = null; return; }
    var el = this.el;
    if (this.espera || el.paused || !isFinite(el.duration)) {
      /* lo normal: llega mientras se espera y empieza ya sin cortes */
      clearTimeout(this.espera);
      this.espera = null;
      if (!el.paused) this.offset = el.currentTime;
      el.pause();
      this.arrancar(ctx.currentTime, this.offset);
      return;
    }
    /* tardó en llegar y ya suena el <audio>: termina esta vuelta y el bucle entra al acabar */
    el.loop = false;
    this.arrancar(ctx.currentTime + Math.max(0, el.duration - el.currentTime), this.lim[0]);
  };

  P.arrancar = function (cuando, desde) {
    var a = this.lim[0], d = this.lim[1] - a;
    desde = desde < a ? a : a + ((desde - a) % d);
    var f = ctx.createBufferSource();
    f.buffer = this.buffer;
    f.loop = true;
    f.loopStart = this.lim[0];
    f.loopEnd = this.lim[1];
    if (!this.ganancia) {
      this.ganancia = ctx.createGain();
      this.ganancia.connect(ctx.destination);
    }
    this.ganancia.gain.value = this.vol;
    f.connect(this.ganancia);
    f.start(cuando, desde);
    this.fuente = f;
    this.inicio = cuando - (desde - a);
  };

  P.posicion = function () {
    if (!this.fuente) return this.el.paused && this.offset ? this.offset : this.el.currentTime;
    var t = ctx.currentTime - this.inicio;
    if (t < 0) return this.el.currentTime;          // aún suena la primera vuelta con el <audio>
    var a = this.lim[0], d = this.lim[1] - a;
    return a + (t % d);
  };

  P.play = function () {
    this.parado = false;
    if (this.buffer) {
      if (!this.fuente) { this.el.pause(); this.arrancar(ctx.currentTime, this.offset); }
      return reanudar();
    }
    this.decodificar();
    if (this.decodificando) {
      /* se espera un poco a la pista decodificada; si tarda, suena el <audio> */
      if (!this.espera) {
        var self = this;
        this.espera = setTimeout(function () {
          self.espera = null;
          if (!self.parado && !self.fuente) self.tocarElemento();
        }, ESPERA);
      }
      return reanudar();
    }
    return this.tocarElemento();
  };

  P.pause = function () {
    if (!this.parado) this.offset = this.posicion();
    this.parado = true;
    clearTimeout(this.espera);
    this.espera = null;
    try { this.el.pause(); } catch (e) {}
    if (this.fuente) {
      try { this.fuente.stop(); } catch (e) {}
      this.fuente = null;
    }
    if (this.liberar) this.buffer = null;
  };

  Object.defineProperties(P, {
    volume: {
      get: function () { return this.vol; },
      set: function (v) {
        this.vol = v;
        this.el.volume = v;
        if (this.ganancia) this.ganancia.gain.value = v;
      }
    },
    paused: {
      get: function () {
        if (this.parado) return true;
        if (this.espera) return false;
        return this.fuente ? ctx.state !== 'running' : this.el.paused;
      }
    },
    currentTime: {
      get: function () { return this.posicion(); },
      set: function (v) {
        this.offset = v;
        try { this.el.currentTime = v; } catch (e) {}
        if (this.fuente) {
          try { this.fuente.stop(); } catch (e) {}
          this.fuente = null;
          this.arrancar(ctx.currentTime, v);
        }
      }
    }
  });

  return MusicaBucle;

})();
