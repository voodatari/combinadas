/* =========================================================
   Voz · hilo aparte (Web Worker) donde vive Piper
   Carga el runtime ONNX, el fonemizador espeak-ng y el modelo de voz UNA vez y los deja en memoria;
   el juego (hilo principal) solo pide textos y recibe el audio, así que las animaciones no se atascan.
   ========================================================= */
'use strict';

var BASE = new URL('piper/', self.location.href).href;
var VOZ = 'es_ES-sharvard-medium', HABLANTE = 'F';      // España · Sharvard · mujer (F = 1 en el modelo)
var config = null, sesion = null, fonemizador = null, esperaFonemas = null, hablante = 0;

function avisar(msg, transfer) { self.postMessage(msg, transfer || []); }

async function descargar(url, alAvanzar) {
    var r = await fetch(url);
    if (!r.ok) throw new Error(r.status + ' ' + url);
    var total = +r.headers.get('Content-Length') || 0;
    if (!r.body || !r.body.getReader) return r.arrayBuffer();
    var lector = r.body.getReader(), trozos = [], cargado = 0;
    for (;;) {
        var x = await lector.read();
        if (x.done) break;
        trozos.push(x.value); cargado += x.value.length;
        if (total) alAvanzar(cargado / total);
    }
    var salida = new Uint8Array(cargado), pos = 0;
    trozos.forEach(function (t) { salida.set(t, pos); pos += t.length; });
    return salida.buffer;
}

/* GUARDADO EN EL DISPOSITIVO. La primera vez, el modelo (~71 MB), el motor ONNX y el fonemizador se guardan en el almacén
   del navegador (Cache Storage); las siguientes visitas los leen de ahí: carga casi instantánea y sin gastar red (también
   sin conexión). El almacén lleva la versión de estos archivos: SI CAMBIA ALGO EN piper/, SUBE VERSION_VOZ y se volverán a
   descargar (los almacenes de versiones anteriores se borran solos). Si el navegador no lo permite, se descarga como siempre. */
var VERSION_VOZ = '2026.10.09-b', PREFIJO_CACHE = 'distributiva-voz-', almacen = null;
async function abrirAlmacen() {
    try {
        if (!self.caches) return null;
        var nombre = PREFIJO_CACHE + VERSION_VOZ, c = await caches.open(nombre);
        (await caches.keys()).forEach(function (k) { if (k.indexOf(PREFIJO_CACHE) === 0 && k !== nombre) caches.delete(k); });
        return c;
    } catch (e) { return null; }
}
/* el archivo como ArrayBuffer: del almacén si ya está; si no, se descarga (con progreso) y se guarda */
async function traer(url, alAvanzar) {
    if (almacen) { try { var g = await almacen.match(url); if (g) { if (alAvanzar) alAvanzar(1); return await g.arrayBuffer(); } } catch (e) {} }
    var buf = await descargar(url, alAvanzar || function () {});
    if (almacen) { try { await almacen.put(url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch (e) {} }
    return buf;
}
/* lo mismo, como dirección blob: (para las librerías que cargan sus archivos ellas solas) */
async function urlLocal(url, tipo) { return URL.createObjectURL(new Blob([await traer(url)], { type: tipo })); }
var urlFonWasm = null, urlFonData = null;

async function iniciar() {
    importScripts(BASE + 'ort/ort.wasm.min.js', BASE + 'piper_phonemize.js');
    almacen = await abrirAlmacen();
    ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': await urlLocal(BASE + 'ort/ort-wasm-simd.wasm', 'application/wasm') };
    ort.env.wasm.numThreads = 1;            // sin hilos de WASM: no hay aislamiento de origen en http local ni en GitHub Pages
    avisar({ t: 'progreso', f: 0.02 });

    config = JSON.parse(await (await fetch(BASE + 'voces/' + VOZ + '.onnx.json')).text());
    hablante = (config.speaker_id_map || {})[HABLANTE] || 0;
    urlFonWasm = await urlLocal(BASE + 'piper_phonemize.wasm', 'application/wasm');
    urlFonData = await urlLocal(BASE + 'piper_phonemize.data', 'application/octet-stream');
    var modelo = await traer(BASE + 'voces/' + VOZ + '.onnx', function (f) { avisar({ t: 'progreso', f: 0.03 + 0.8 * f }); });
    sesion = await ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
    avisar({ t: 'progreso', f: 0.86 });

    await crearFonemizador();
    avisar({ t: 'progreso', f: 0.93 });
    await sintetizar('listo');                // calentamiento: la primera síntesis es la más lenta
    avisar({ t: 'progreso', f: 1 });
    avisar({ t: 'lista', sr: config.audio.sample_rate });
}

/* El fonemizador (espeak en WebAssembly) se rompe tras ~155 llamadas seguidas («table index is out of bounds» / «memory access
   out of bounds») y ya no se recupera. Por eso se recrea cada MAX_LLAMADAS llamadas y, si una falla, se recrea y se reintenta.
   Además los resultados se guardan: una misma sílaba o palabra no se vuelve a fonemizar. */
var llamadas = 0, MAX_LLAMADAS = 50, cacheFonemas = {};
async function crearFonemizador() {
    fonemizador = await createPiperPhonemize({
        print: function (linea) {
            try {
                var dd = JSON.parse(linea);
                if (dd && dd.phoneme_ids && esperaFonemas) { var ff = esperaFonemas; esperaFonemas = null; ff(dd.phoneme_ids); }
            } catch (e) {}
        },
        printErr: function () {},
        locateFile: function (u) { return u.indexOf('.wasm') > 0 ? (urlFonWasm || BASE + 'piper_phonemize.wasm') : u.indexOf('.data') > 0 ? (urlFonData || BASE + 'piper_phonemize.data') : BASE + 'piper_phonemize.js'; }
    });
    llamadas = 0;
}
/* espeak lee como el NOMBRE de la letra («i acentuada», «a acentuada»…) una vocal con tilde SOLA (á é í ú, también en mayúscula) y también
   las sílabas «ás» «és» «ís» «ús» (la sílaba «ís» de «he-ro-ís-mo» sonaba «i acentuada ese»). Se manda sin tilde: la tónica la marca el
   juego por su cuenta (acento, tono y duración). Comprobado con espeak: con «ó» y con el resto de sílabas con tilde no pasa. */
var VOCAL_SOLA = /(^|[^\p{L}])([áéíóúÁÉÍÓÚ])([sS]?)(?![\p{L}])/gu, SIN_TILDE = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U' };
async function fonemas(texto) {
    texto = String(texto).replace(VOCAL_SOLA, function (m, antes, v, s) { return antes + SIN_TILDE[v] + s; });
    if (cacheFonemas[texto]) return cacheFonemas[texto].slice();
    if (llamadas >= MAX_LLAMADAS) await crearFonemizador();
    for (var intento = 0; intento < 3; intento++) {
        try {
            var ids = await new Promise(function (ok, mal) {
                esperaFonemas = ok; llamadas++;
                try { fonemizador.callMain(['-l', config.espeak.voice, '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']); }
                catch (e) { esperaFonemas = null; mal(e); }
            });
            cacheFonemas[texto] = ids;
            return ids.slice();
        } catch (e) { await crearFonemizador(); }
    }
    throw new Error('El fonemizador no responde');
}

/* ---------- fonemas como símbolos (para controlar el acento y la duración nosotros) ---------- */
var inverso = null;
function mapaInverso() {
    if (inverso) return inverso;
    inverso = {};
    Object.keys(config.phoneme_id_map).forEach(function (k) { inverso[config.phoneme_id_map[k][0]] = k; });
    return inverso;
}
var NO_SIMBOLO = { '_': 1, '^': 1, '$': 1 };
function simbolos(ids) {
    var m = mapaInverso(), out = [];
    ids.forEach(function (id) { var s = m[id]; if (s != null && !NO_SIMBOLO[s]) out.push(s); });
    return out;
}
/* secuencia de símbolos → ids de Piper: ^ _ f _ f _ … $ */
function aIds(simb) {
    var ids = [1, 0];
    simb.forEach(function (s) { var id = (config.phoneme_id_map[s] || [])[0]; if (id != null) ids.push(id, 0); });
    ids.push(2);
    return ids;
}
function sinAcentos(simb) { return simb.filter(function (s) { return s !== 'ˈ' && s !== 'ˌ'; }); }
/* modo claro: la «g», la «d» y la «b/v» suaves (ɣ, ð, β) casi se pierden en Piper («complicidad» → «compliciad»); se dicen como oclusivas */
function gClara(simb) { return simb.map(function (s) { return s === 'ɣ' ? 'ɡ' : s === 'ð' ? 'd' : s === 'β' ? 'b' : s; }); }
var FUERTES = ['a', 'e', 'o', 'ɛ', 'ɔ'], VOCALES = ['a', 'e', 'i', 'o', 'u', 'ɛ', 'ɔ', 'ɐ', 'ə'];
/* índice de la vocal que es el centro de la sílaba (la más fuerte; en un diptongo, la abierta) */
function nucleo(simb) {
    var i;
    for (i = 0; i < simb.length; i++) if (FUERTES.indexOf(simb[i]) >= 0) return i;
    for (i = simb.length - 1; i >= 0; i--) if (VOCALES.indexOf(simb[i]) >= 0) return i;
    return -1;
}

/* espeak marca como acentuada (ˈ) CADA sílaba suelta, y entonces ninguna destaca.
   acento = 'atona' quita la marca; 'tonica' la deja; sin acento, tal cual. La tónica además suena más fuerte. */
function conAcento(ids, acento) {
    if (!acento) return ids;
    var idAc = (config.phoneme_id_map['ˈ'] || [])[0], idSec = (config.phoneme_id_map['ˌ'] || [])[0], out = [];
    for (var i = 0; i < ids.length; i++) {
        var esMarca = ids[i] === idAc || ids[i] === idSec;
        if (esMarca && (acento === 'atona' || ids[i] === idSec)) { if (ids[i + 1] === 0) i++; continue; }   // se quita la marca y su relleno
        out.push(ids[i]);
    }
    return out;
}

/* claro: la g suave entre vocales (ɣ) casi no se oye y «ahogo» suena «ao»: para las palabras sueltas se usa la g clara (ɡ) */
function conGClara(ids) {
    var suave = (config.phoneme_id_map['ɣ'] || [])[0], clara = (config.phoneme_id_map['ɡ'] || [])[0];
    if (suave == null || clara == null) return ids;
    return ids.map(function (x) { return x === suave ? clara : x; });
}

/* PALABRA con el acento que NOSOTROS sabemos: espeak se equivoca con algunas palabras sueltas («fortalecer», «fisiología»).
   Se fonemiza la palabra entera (suena natural) y se quita su acento; la sílaba tónica se localiza fonemizando cada
   sílaba y contando símbolos, y se le pone el acento (ˈ) delante de su vocal. Si las cuentas no cuadran, se deja espeak. */
/* LOS FONEMAS DE LA PALABRA ENTERA, repartidos por sílabas. NO se fonemiza cada sílaba suelta: espeak lee «rrí» como las
   letras «erre-í» y la «r» de «ro» como vibrante aunque en la palabra sea suave. Se fonemiza la palabra entera (suena natural:
   r suave, b d g relajadas…) y se reparte con la longitud de cada sílaba (la «rr» inicial se cuenta como una sola r: así cuadra).
   Devuelve { partes, natural }; si las cuentas no cuadran, partes = fonemas de cada sílaba suelta y natural = false. */
async function simbolosPorSilaba(texto, silabas) {
    var todo = sinAcentos(simbolos(await fonemas(texto))), sueltas = [], total = 0, k;
    for (k = 0; k < silabas.length; k++) {
        var s = sinAcentos(simbolos(await fonemas(silabas[k].replace(/^rr/, 'r').replace(/^x/, k === 0 ? 's' : 'ks'))));
        sueltas.push(s); total += s.length;
    }
    if (total !== todo.length) return { partes: sueltas, natural: false, todo: null };
    var partes = [], pos = 0;
    for (k = 0; k < sueltas.length; k++) { partes.push(todo.slice(pos, pos + sueltas[k].length)); pos += sueltas[k].length; }
    return { partes: partes, natural: true, todo: todo };
}

/* PALABRA con el acento que NOSOTROS sabemos: espeak se equivoca con algunas palabras sueltas («fortalecer», «fisiología»)
   y pone marcas secundarias (ˌ) que se oyen como una segunda tónica. Se quitan sus acentos y se pone la ˈ delante de la
   vocal de la sílaba tónica. Si las cuentas no cuadran se deja espeak. */
async function palabraConAcento(texto, silabas, tonica) {
    var r = await simbolosPorSilaba(texto, silabas);
    if (!r.natural) return null;
    var pos = 0, k;
    for (k = 0; k < tonica; k++) pos += r.partes[k].length;
    var n = nucleo(r.partes[tonica]);
    if (n < 0) return null;
    var todo = r.todo.slice(), antes = pos, despues = r.todo.length - pos - r.partes[tonica].length;
    todo.splice(pos + n, 0, 'ˈ');
    var extra = 1;
    if (tonica === silabas.length - 1) { todo.splice(pos + n + 2, 0, todo[pos + n + 1]); extra = 2; }     // tónica final: vocal un poco más larga
    var total = todo.length;
    // tramo (0..1) de la palabra que ocupa la sílaba tónica, por reparto de símbolos
    tramoTonica = { desde: antes / total, hasta: (total - despues) / total };
    // tramo (0..1) de cada sílaba, para poder comparar la fuerza de las átonas con la de la tónica
    tramosSilabas = []; var acum = 0;
    for (k = 0; k < r.partes.length; k++) {
        var largo = r.partes[k].length + (k === tonica ? extra : 0);
        tramosSilabas.push({ desde: acum / total, hasta: (acum + largo) / total }); acum += largo;
    }
    return todo;
}
var tramoTonica = null, tramosSilabas = [], infoRangos = "";
/* Sílabas de una palabra sintetizada, localizadas por los picos de energía de sus vocales (envolvente de 20 ms, suavizada).
   Devuelve n rangos {a,b} en muestras (la frontera es el valle entre dos picos) o null si no salen exactamente n picos. */
function rangosPorPicos(pcm, i1, f1, n, sr) {
    var hop = Math.floor(0.005 * sr), ven = Math.floor(0.02 * sr), env = [], pos = [], z, j;
    for (z = i1; z + ven <= f1; z += hop) { var q = 0; for (j = z; j < z + ven; j++) q += pcm[j] * pcm[j]; env.push(Math.sqrt(q / ven)); pos.push(z + ven / 2); }
    if (env.length < 4 * n) return null;
    var lis = env.map(function (e, k) { var s = 0, c = 0; for (var d = -3; d <= 3; d++) if (env[k + d] != null) { s += env[k + d]; c++; } return s / c; });
    var max = Math.max.apply(null, lis), umbrales = [0.2, 0.3, 0.4, 0.5, 0.6], u, picos;
    for (u = 0; u < umbrales.length; u++) {
        picos = [];
        for (z = 1; z < lis.length - 1; z++) {
            if (lis[z] < umbrales[u] * max || lis[z] < lis[z - 1] || lis[z] < lis[z + 1]) continue;
            var sep = Math.floor(0.09 * sr);
            if (picos.length && pos[z] - pos[picos[picos.length - 1]] < sep) { if (lis[z] > lis[picos[picos.length - 1]]) picos[picos.length - 1] = z; continue; }
            picos.push(z);
        }
        if (picos.length === n) break;
    }
    if (!picos || picos.length !== n) return null;
    var cortes = [i1];
    for (j = 0; j < n - 1; j++) { var m = picos[j]; for (z = picos[j]; z <= picos[j + 1]; z++) if (lis[z] < lis[m]) m = z; cortes.push(Math.floor(pos[m])); }
    cortes.push(f1);
    return cortes.slice(0, n).map(function (a, k) { return { a: a, b: cortes[k + 1] }; });
}

/* símbolos de una palabra, con nuestro acento si se sabe (si no, los de espeak) */
var ultimoAcento = '';
async function simbolosDePalabra(texto, extra, claro) {
    var s = null;
    if (extra && extra.tipo === 'palabra') s = await palabraConAcento(texto, extra.silabas, extra.tonica);
    ultimoAcento = s ? 'propio' : 'espeak';
    if (!s) s = simbolos(await fonemas(texto));
    return claro ? gClara(s) : s;
}

/* SILABEO: toda la palabra en UN solo enunciado, sílaba a sílaba, sin pausas, con la vocal de cada sílaba alargada
   (n-e-e-e g-l-i-i-i ...) y mucho más la de la tónica. Devuelve los ids y el peso (duración relativa) de cada sílaba. */
var REP_ATONA = 6, REP_TONICA = 18, ESCALA_SILABEO = 1.6;      // vocal alargada: «neeegliiiigeeeeeenteee»
async function silabeo(extra, claro) {
    var secs = [], k, j, repA = extra.repA || REP_ATONA, repT = extra.repT || REP_TONICA;
    var r = await simbolosPorSilaba(extra.palabra || extra.silabas.join(''), extra.silabas);
    for (k = 0; k < r.partes.length; k++) {
        var s = r.partes[k], n = nucleo(s), seq = [];
        for (j = 0; j < s.length; j++) {
            if (j === n) {
                if (k === extra.tonica) seq.push('ˈ');
                for (var q = 0, rep = k === extra.tonica ? repT : repA; q < rep; q++) seq.push(s[j]);
            } else seq.push(s[j]);
        }
        secs.push(seq);
    }
    function ids(hasta) { var out = []; for (var z = 0; z <= hasta; z++) out = out.concat(secs[z]); return aIds(claro ? gClara(out) : out); }
    return { secs: secs, ids: ids };
}

/* TÓNICA SUELTA: se sube un cuarto de tono (50 cents = 2^(1/24)) para marcarla. Se remuestrea con interpolación cúbica:
   sube el tono y la sílaba dura un 3 % menos. */
var TONO_TONICA = Math.pow(2, 1 / 16);       // tres cuartos de tono (75 cents)
function subirTono(pcm, razon) {
    var n = Math.floor((pcm.length - 3) / razon), out = new Float32Array(n), i, x, k, f, y0, y1, y2, y3;
    for (i = 0; i < n; i++) {
        x = i * razon; k = Math.floor(x); f = x - k;
        y0 = pcm[Math.max(0, k - 1)]; y1 = pcm[k]; y2 = pcm[k + 1]; y3 = pcm[k + 2];
        out[i] = y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
    }
    return out;
}
/* sube el volumen del tramo fricativo inicial (hasta que arranca la vocal, cuando la energía de 20 ms supera la mitad de su máximo) */
function realzarFricativa(pcm, ganancia) {
    var sr = config.audio.sample_rate, N = Math.floor(0.02 * sr), pico = 0, i, s, e, env = [], max = 0, i0 = 0;
    for (i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
    while (i0 < pcm.length && Math.abs(pcm[i0]) < pico * 0.02) i0++;
    for (s = i0; s + N <= pcm.length; s += N) { e = 0; for (i = s; i < s + N; i++) e += pcm[i] * pcm[i]; e = Math.sqrt(e / N); env.push(e); if (e > max) max = e; }
    var k = 0; while (k < env.length && env[k] < 0.5 * max) k++;
    var fin = i0 + k * N, rp = Math.floor(0.015 * sr);
    for (i = i0; i < fin + rp && i < pcm.length; i++) pcm[i] *= 1 + (ganancia - 1) * (i <= fin ? 1 : 1 - (i - fin) / rp);
    return pcm;
}
/* duración de la voz (en muestras) de un audio: del primer al último punto por encima del 4 % del pico */
function vozDe(pcm) { var f = finDeVoz(pcm), pico = 0, i = 0; for (var k = 0; k < pcm.length; k++) pico = Math.max(pico, Math.abs(pcm[k])); while (i < pcm.length && Math.abs(pcm[i]) < pico * 0.04) i++; return Math.max(0, f - i); }
/* fin de la voz (muestra) de un audio: último punto por encima del 4 % del pico */
function finDeVoz(pcm) {
    var pico = 0, i;
    for (i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
    var um = pico * 0.04, fin = pcm.length - 1;
    while (fin > 0 && Math.abs(pcm[fin]) < um) fin--;
    return fin;
}
var ultDur = null;
async function inferir(ids, escala, ruidoDuracion) {
    var feeds = {
        input: new ort.Tensor('int64', ids, [1, ids.length]),
        input_lengths: new ort.Tensor('int64', [ids.length]),
        scales: new ort.Tensor('float32', [config.inference.noise_scale, config.inference.length_scale * (escala || 1), ruidoDuracion != null ? ruidoDuracion : config.inference.noise_w])
    };
    if (config.speaker_id_map && Object.keys(config.speaker_id_map).length) feeds.sid = new ort.Tensor('int64', [hablante]);
    var res = await sesion.run(feeds);
    // duración (en fotogramas de 256 muestras) de cada id de la entrada: sale de la salida extra que se añadió al modelo
    ultDur = res['/Ceil_output_0'] ? Float32Array.from(res['/Ceil_output_0'].data) : null;
    return Float32Array.from(res.output.data);
}

/* PORTADORA: dicha sola, una palabra suena peor que dentro de una frase («terrícola» → «tericola»), porque Piper la oye
   justo al empezar. Se sintetiza «la, terrícola» y se descarta el «la,». El corte no puede basarse en la duración de la
   portadora (dentro de la frase dura menos que sola) ni en un silencio mínimo (el hueco va de 5 a 150 ms según la palabra).
   Se sigue la energía: la portadora suena primero y decae; cuando baja del UMBRAL termina (k0), y cuando vuelve a subir
   empieza la palabra (onset). Se corta PREROLL antes del onset, pero nunca antes de k0: así una consonante suave (s, f…)
   no se pierde y no entra nada audible de la portadora. */
/* la palabra va entre comillas dentro de la frase ("esta es la palabra, \"x\""): ayuda a Piper a leerla como una palabra aislada */
var COMILLAS_PALABRA = true;
/* PALABRA SUELTA. Se sintetiza la frase «Esta era la palabra: X» tal cual (fonemas y entonación de espeak/Piper) y se descarta
   todo lo que hay hasta el final de «palabra». El punto de corte es exacto: el modelo se ha ampliado con una segunda salida
   (/Ceil_output_0) con la duración en fotogramas (256 muestras) de cada id de entrada. El final NO se toca: la palabra cierra
   la frase y termina como la termina Piper. Se empieza 20 ms antes del primer fonema de X (se salta la pausa de los dos puntos)
   y, si espeak pusiera la tónica en otra sílaba, se pone la nuestra. Si algo no cuadra devuelve null (método antiguo). */
var FRASE_ANTES = 'Esta era la palabra:', HOP = 256;
function igual(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
async function palabraEnFrase(texto, extra, escala) {
    var sr = config.audio.sample_rate, i, k;
    var P = simbolos(await fonemas(FRASE_ANTES)), S = simbolos(await fonemas(FRASE_ANTES + ' ' + texto));
    if (!igual(S.slice(0, P.length), P)) return null;
    var dos = P.lastIndexOf(':');                       // «palabra» acaba justo antes de los dos puntos
    if (dos < 1) return null;
    var W = S.slice(P.length).filter(function (x, n, arr) { return !(n === 0 && x === ' '); });
    while (W.length && /[.,:;!?s]/.test(W[W.length - 1])) W.pop();
    if (!W.length) return null;
    // tónica: si espeak la pone donde debe, no se toca nada; si no, se pone la nuestra
    var acento = 'espeak', r = await simbolosPorSilaba(texto, extra.silabas);
    if (r.natural && igual(sinAcentos(W), r.todo)) {
        var cuenta = 0, marca = -1, silabaMarca = -1, acum = 0;
        for (k = 0; k < W.length; k++) { if (W[k] === 'ˈ') { marca = cuenta; break; } if (W[k] !== 'ˌ') cuenta++; }
        if (marca >= 0) for (k = 0; k < r.partes.length; k++) { if (marca < acum + r.partes[k].length) { silabaMarca = k; break; } acum += r.partes[k].length; }
        if (silabaMarca !== extra.tonica) {
            var tp = 0; for (k = 0; k < extra.tonica; k++) tp += r.partes[k].length;
            var nu = nucleo(r.partes[extra.tonica]);
            if (nu >= 0) { var W2 = r.todo.slice(); W2.splice(tp + nu, 0, 'ˈ'); S = S.slice(0, P.length).concat([' '], W2); acento = 'propio'; }
        }
    }
    var ids = aIds(S), pcm = await inferir(ids, escala), dur = ultDur;
    if (!dur || dur.length !== ids.length) return null;
    var idFin = 2 + 2 * (dos - 1) + 1, corte = 0;      // último fonema de «palabra» y su relleno
    for (i = 0; i <= idFin; i++) corte += dur[i];
    corte *= HOP;
    // entre «palabra» y X está la pausa de los dos puntos: se empieza 20 ms antes del primer fonema de X (también exacto por
    // las duraciones). Así no entra la cola de la «a» de «palabra», que sigue sonando un poco tras su final, ni silencio de más.
    var j0 = P.length + (S[P.length] === ' ' ? 1 : 0), inicioX = 0;
    for (i = 0; i < 2 + 2 * j0; i++) inicioX += dur[i];
    inicioX *= HOP;
    var desde = Math.max(corte, inicioX - Math.floor(0.02 * sr));
    var sal = pcm.slice(desde), fi = Math.floor(0.005 * sr);
    for (i = 0; i < fi && i < sal.length; i++) sal[i] *= i / fi;     // 5 ms de entrada (sin chasquido); el final no se toca
    ultimoAcento = acento;
    return { pcm: sal, info: { frase: true, acento: acento, corteMs: Math.round(corte / sr * 1000), inicioXMs: Math.round(inicioX / sr * 1000), desdeMs: Math.round(desde / sr * 1000), palabraMs: Math.round((pcm.length - desde) / sr * 1000) } };
}
var duraciones = {};
async function duracionPortadora(car, escala) {
    var clave = car.join('') + '|' + escala;
    if (duraciones[clave] == null) { var p = await inferir(aIds(car), escala); duraciones[clave] = vozDe(p) / config.audio.sample_rate; }
    return duraciones[clave];
}
var UMBRAL_PORTADORA = 0.12, PREROLL_PORTADORA = 0.09;
async function conPortadora(simb, portadora, escala, opciones) {
    opciones = opciones || {};
    var sr = config.audio.sample_rate, i, umbral = opciones.umbral || UMBRAL_PORTADORA, preroll = opciones.preroll != null ? opciones.preroll : PREROLL_PORTADORA;
    var sep = opciones.separador || ',';
    var car = sinAcentos(simbolos(await fonemas(portadora))).concat([sep, ' ']);
    var cola = opciones.cola ? sinAcentos(simbolos(await fonemas(opciones.cola))) : null;
    var pcm = await inferir(aIds(car.concat((opciones.comillas != null ? opciones.comillas : COMILLAS_PALABRA) ? ['"'].concat(simb, ['"']) : simb, cola ? [sep, ' '].concat(cola) : [])), escala), pico = 0;
    for (i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
    var trozo = Math.floor(0.005 * sr), um = pico * umbral, k0 = -1, onset = -1;
    for (var p = Math.floor(0.1 * sr); p + trozo < pcm.length; p += trozo) {
        var mx = 0; for (i = p; i < p + trozo; i++) mx = Math.max(mx, Math.abs(pcm[i]));
        if (k0 < 0) { if (mx < um) k0 = p; }                 // la portadora ha terminado
        else if (mx >= um) { onset = p; break; }             // y vuelve el sonido: empieza la palabra
    }
    if (portadora.indexOf(' ') > 0) {
        /* PORTADORA LARGA («esta es la palabra»): tiene pausas internas entre sus palabras, así que no sirve «el primer hueco».
           Se mide cuánto dura sola (D0, una vez por velocidad) y el corte es el primer hueco de >= 40 ms que empieza a partir
           de 0,85·D0: la pausa que sigue a la portadora (la coma) cae siempre ahí, antes de cualquier hueco de la palabra. */
        var d0 = await duracionPortadora(car.slice(0, car.length - 2), escala), ini2 = -1, gh = null;
        for (var pq = Math.floor(0.85 * d0 * sr); pq + trozo < pcm.length; pq += trozo) {
            var m3 = 0; for (i = pq; i < pq + trozo; i++) m3 = Math.max(m3, Math.abs(pcm[i]));
            if (m3 < um) { if (ini2 < 0) ini2 = pq; }
            else if (ini2 >= 0) { if (pq - ini2 >= 0.04 * sr) { gh = { a: ini2, b: pq }; break; } ini2 = -1; }
        }
        if (!gh) return null;
        k0 = gh.a; onset = gh.b;
    } else if (opciones.huecos) { var hs = [], ini = -1; for (var pp = 0; pp + trozo < pcm.length; pp += trozo) { var m2 = 0; for (i = pp; i < pp + trozo; i++) m2 = Math.max(m2, Math.abs(pcm[i])); if (m2 < um) { if (ini < 0) ini = pp; } else if (ini >= 0) { if (pp - ini >= 0.02 * sr) hs.push(Math.round(ini / sr * 1000) + '+' + Math.round((pp - ini) / sr * 1000)); ini = -1; } } return { pcm: pcm, info: { huecos: hs.join(' '), total: Math.round(pcm.length / sr * 1000) } }; }
    if (k0 < 0 || onset < 0) return null;
    var desde = Math.max(k0, onset - Math.floor(preroll * sr));
    var hasta = pcm.length, finCola = false;
    if (cola) {
        /* COLA: una tónica FINAL («melocotón», «diagnosticar») suena floja y sin subida de tono porque Piper cierra la frase justo
           ahí. Con otra palabra detrás, la tónica va dentro de la frase. Se corta en el último hueco (>= 25 ms de silencio). */
        var q = pcm.length - trozo, enVoz = false, silencio = 0;
        for (; q > onset; q -= trozo) {
            var mq = 0; for (i = q; i < q + trozo; i++) mq = Math.max(mq, Math.abs(pcm[i]));
            if (mq >= um) { if (!enVoz) enVoz = true; else if (silencio >= 0.025 * sr) break; silencio = 0; }
            else if (enVoz) silencio += trozo;
        }
        if (enVoz && q > onset) { hasta = q + trozo + Math.floor(0.03 * sr); finCola = true; }
    }
    if (cola && !finCola) return null;
    var sal = pcm.slice(desde, hasta), fade = Math.floor(0.012 * sr);
    for (i = 0; i < fade && i < sal.length; i++) sal[sal.length - 1 - i] *= (cola ? i / fade : 1);
    for (i = 0; i < fade && i < sal.length; i++) sal[i] *= i / fade;
    return { pcm: sal, info: { k0Ms: Math.round(k0 / sr * 1000), onsetMs: Math.round(onset / sr * 1000), palabraMs: Math.round(sal.length / sr * 1000), cola: !!cola } };
}

async function sintetizar(texto, escala, acento, claro, extra) {
    var ids, sb = null, marcas = null, pcm, pico = 0, i, sr = config.audio.sample_rate, infoCorte = null;
    if (extra && extra.tipo === 'silabeo') {
        sb = await silabeo(extra, claro);
        var esc = (escala || 1) * (extra.escala || ESCALA_SILABEO), nsil = sb.secs.length;
        // fronteras REALES: se sintetiza cada prefijo (sílabas 0..k) y se mide dónde acaba su voz
        var fines = [];
        for (var q = 0; q < nsil - 1; q++) fines.push(finDeVoz(await inferir(sb.ids(q), esc)) / sr);
        ids = sb.ids(nsil - 1);
        pcm = await inferir(ids, esc);
        marcas = [];
        var ini0 = 0, um0 = 0;
        for (i = 0; i < pcm.length; i++) um0 = Math.max(um0, Math.abs(pcm[i]));
        um0 *= 0.04; while (ini0 < pcm.length && Math.abs(pcm[ini0]) < um0) ini0++;
        marcas.push(+(ini0 / sr).toFixed(3));
        fines.forEach(function (t) { marcas.push(+t.toFixed(3)); });
    } else {
        if (extra && extra.tipo === 'silabaTexto') {
            // una sílaba suelta escrita con guion: espeak la acentúa casi siempre, así que se quita todo acento
            // y solo la tónica recibe el suyo (delante de su vocal)
            var ss = sinAcentos(simbolos(await fonemas(extra.texto))), nn = nucleo(ss);
            var conJota = ss[0] === 'x';
            if (conJota && !extra.jota) extra.jota = 'x|x';       // jota inicial: se dobla para que su fricación se oiga («ge» sonaba «gue»)
            if (extra.jota) ss = ss.reduce(function (o, x) { return o.concat(x === 'x' ? extra.jota.split('|') : [x]); }, []), nn = nucleo(ss);
            if (nn >= 0) ss.splice(nn, 0, extra.tonica ? 'ˈ' : '', ss[nn]);        // la vocal se duplica: dura más y se oye clara
            ss = ss.filter(function (x) { return x !== ''; });
            ids = aIds(claro ? gClara(ss) : ss);
        }
        if (extra && extra.tipo === 'palabra') {
            tramosSilabas = []; tramoTonica = null;
            if (extra.portadora && extra.frase !== false) { var rf = await palabraEnFrase(texto, extra, escala); if (rf) { pcm = rf.pcm; infoCorte = rf.info; } }
        }
        if (!pcm && extra && extra.tipo === 'palabra') {
            var simb = await simbolosDePalabra(texto, extra, claro);
            if (extra.portadora) { var rc = null, ultima = true;       // la palabra va SIEMPRE dentro de una frase: «la, palabra, la» y se recorta solo la palabra
                if (ultima && extra.cola !== false) rc = await conPortadora(simb, extra.portadora, escala, { separador: extra.separador, huecos: extra.huecos, comillas: extra.comillas, umbral: extra.umbral, preroll: extra.preroll, cola: extra.cola || 'la' });
                if (!rc) rc = await conPortadora(simb, extra.portadora, escala, { separador: extra.separador, huecos: extra.huecos, comillas: extra.comillas, umbral: extra.umbral, preroll: extra.preroll }); if (rc) { pcm = rc.pcm; infoCorte = rc.info; } }
            if (!pcm) ids = aIds(simb);
        }
        if (!pcm) {
            if (!ids) { ids = conAcento(await fonemas(texto), acento); if (claro) ids = conGClara(ids); }
            pcm = await inferir(ids, escala);
            if (extra && extra.tipo === 'silabaTexto') {
                // duración mínima de la voz de una sílaba suelta (si no, «pi», «ña», «te» salen cortísimas y la vocal no se oye)
                var minimo = extra.tonica ? 0.55 : 0.4, dv = vozDe(pcm) / sr;
                if (dv > 0 && dv < minimo) pcm = await inferir(ids, escala * Math.min(2, minimo / dv));
                if (extra.tonica) pcm = subirTono(pcm, TONO_TONICA);
                if (conJota) pcm = realzarFricativa(pcm, 3);
            }
        }
    }
    for (i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
    /* Piper deja caer la voz al final de la frase: una tónica FINAL («capó», «fortalecer») sale más floja que la primera sílaba
       y suena «cápo». Se refuerza el tramo de la tónica (+4 dB aprox., con rampas de 50 ms) antes de normalizar. */
    if (extra && extra.tipo === 'palabra' && ultimoAcento === 'propio' && tramosSilabas.length > 1 && pico > 0) {
        var um1 = pico * 0.04, i1 = 0, f1 = pcm.length - 1;
        while (i1 < pcm.length && Math.abs(pcm[i1]) < um1) i1++;
        while (f1 > i1 && Math.abs(pcm[f1]) < um1) f1--;
        // dónde está cada sílaba: por los picos de energía de sus vocales; si no salen tantos como sílabas, por reparto de fonemas
        var rangosPicos = rangosPorPicos(pcm, i1, f1, tramosSilabas.length, sr), rangos = rangosPicos || tramosSilabas.map(function (t) {
            return { a: i1 + Math.floor(t.desde * (f1 - i1)), b: i1 + Math.floor(t.hasta * (f1 - i1)) };
        });
        var tn = extra.tonica, rp = Math.floor(0.05 * sr);
        var rampear = function (a, b, ancho, gananciaMax) {
            for (var z = Math.max(0, a - ancho); z < Math.min(pcm.length, b + ancho); z++) {
                var fr = z < a ? (z - (a - ancho)) / ancho : z > b ? 1 - (z - b) / ancho : 1;
                pcm[z] *= 1 + (gananciaMax - 1) * Math.max(0, Math.min(1, fr));
            }
        };
        // Piper deja caer la voz al final de la frase: una tónica FINAL («capó», «fortalecer») sale floja y suena «cápo»: +4 dB
        rampear(rangos[tn].a, rangos[tn].b, rp, tn === tramosSilabas.length - 1 ? 1.9 : 1.6);
        /* Piper también acentúa por su cuenta alguna átona («observatorio» → «obsérvatorio»). Ninguna átona puede sonar más
           fuerte que el 55 % de la tónica: si se pasa, se baja (como mucho a 0,4). Fuerza = rms del 60 % central de la sílaba. */
        var rmsRango = function (r) {
            var m = Math.floor((r.b - r.a) * 0.2), q = 0, c = 0, z;
            for (z = r.a + m; z < r.b - m; z++) { q += pcm[z] * pcm[z]; c++; }
            return c ? Math.sqrt(q / c) : 0;
        };
        var rT = rmsRango(rangos[tn]);
        if (rT > 0) {
            rangos.forEach(function (r, k) {
                if (k === tn) return;
                var rA = rmsRango(r);
                if (rA > 0.55 * rT) rampear(r.a, r.b, Math.floor(0.04 * sr), Math.max(0.4, 0.55 * rT / rA));
            });
        }
        if (extra.depurar) { var rr = rangos.map(rmsRango), mx = 0; rr.forEach(function (x, k) { if (k !== tn && x > mx) mx = x; }); infoRangos = (rangosPicos ? 'picos' : 'reparto') + ' ratio=' + (mx / (rr[tn] || 1)).toFixed(2); }
        pico = 0; for (i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
    }

    if (marcas && pico > 0) {
        // silabeo: tramo con voz, igualar la energía a la de las frases y dar a la tónica más fuerza
        var um = pico * 0.04, ini = 0, fin = pcm.length - 1, suma = 0, cuenta = 0;
        while (ini < pcm.length && Math.abs(pcm[ini]) < um) ini++;
        while (fin > ini && Math.abs(pcm[fin]) < um) fin--;
        for (i = ini; i <= fin; i++) { suma += pcm[i] * pcm[i]; cuenta++; }
        var gs = 0.22 / Math.sqrt(suma / Math.max(1, cuenta));
        for (i = 0; i < pcm.length; i++) pcm[i] *= gs;
        // la tónica, un poco más fuerte (con rampas suaves de 50 ms)
        var t0 = Math.floor(marcas[extra.tonica] * sr), t1 = extra.tonica + 1 < marcas.length ? Math.floor(marcas[extra.tonica + 1] * sr) : fin, rampa = Math.floor(0.05 * sr);
        for (i = Math.max(0, t0 - rampa); i < Math.min(pcm.length, t1 + rampa); i++) {
            var f = i < t0 ? (i - (t0 - rampa)) / rampa : i > t1 ? 1 - (i - t1) / rampa : 1;
            pcm[i] *= 1 + 0.3 * Math.max(0, Math.min(1, f));
        }
        var p2 = 0; for (i = 0; i < pcm.length; i++) p2 = Math.max(p2, Math.abs(pcm[i]));
        if (p2 > 0.97) { var gl = 0.97 / p2; for (i = 0; i < pcm.length; i++) pcm[i] *= gl; }
    } else if (acento && pico > 0) {
        // sílabas sueltas: se iguala la ENERGÍA (no el pico) para que la diferencia de intensidad sea real
        var umbral = pico * 0.05, s2 = 0, n2 = 0;
        for (i = 0; i < pcm.length; i++) if (Math.abs(pcm[i]) >= umbral) { s2 += pcm[i] * pcm[i]; n2++; }
        var rms = Math.sqrt(s2 / Math.max(1, n2));
        var g = (acento === 'tonica' ? 0.31 : 0.21) / rms;
        if (pico * g > 0.98) g = 0.98 / pico;
        for (i = 0; i < pcm.length; i++) pcm[i] *= g;
    } else if (pico > 0) {
        var g2 = 0.9 / pico; for (i = 0; i < pcm.length; i++) pcm[i] *= g2;
    }
    return { dur: extra && extra.durTest ? ultDur : null, pcm: pcm, marcas: marcas, simbolos: extra && extra.depurar ? '[' + ultimoAcento + '] ' + (ids ? simbolos(ids).join('') : '') + (infoCorte ? ' ' + JSON.stringify(infoCorte) : ' (sin portadora)') + ' ' + infoRangos : null };
}

var cola = Promise.resolve();
self.onmessage = function (e) {
    var m = e.data;
    if (m.t === 'init') {
        iniciar().catch(function (err) { avisar({ t: 'error', msg: String(err && err.message || err) }); });
    } else if (m.t === 'sint') {
        cola = cola.then(function () {
            return sintetizar(m.texto, m.escala, m.acento, m.claro, m.extra).then(function (r) {
                avisar({ t: 'pcm', id: m.id, dur: r.dur, pcm: r.pcm, marcas: r.marcas, simbolos: r.simbolos, sr: config.audio.sample_rate }, [r.pcm.buffer]);
            });
        }).catch(function (err) { avisar({ t: 'fallo', id: m.id, msg: String(err && err.message || err) }); });
    }
};
