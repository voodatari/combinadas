/* =========================================================
   Combinadas · motor de contenido (mismo código en el navegador y en Node)

   Una operación (q) es una lista de fichas con N números y N−1 operaciones (cada operación es un «paso»):
     niveles 1 y 2 → 3 números, 2 pasos:  4 + 3 × 5 · 10 − 6 + 2
     nivel 3       → 4 números, 3 pasos:  (4 + 3) × 5 − 2 · 8 + 3 × (9 − 4)
   Un paréntesis siempre envuelve UNA sola operación entre dos números: ( 4 + 3 ).
   El «primer paso» de un estado sigue la regla: el primer paréntesis; si no hay, la primera × ÷ de la izquierda;
   si no, la primera + − de la izquierda. q.estados[k] es la operación tras k pasos (q.estados[N−1] = el resultado);
   q.pasos[k] describe el paso k (qué fichas ocupa, su cuenta y su valor).

   Colores de los números en toda la web, según su sitio: a (1.º) amarillo · b (2.º) azul · c (3.º) naranja · e (4.º) rosa.
   Los resultados de los pasos van en verde (rol-r); los números sueltos de las respuestas, en violeta (rol-d).

   Los números y los resultados son distintos entre sí, para que no haya dos lecturas válidas.
   Cada «ficha» (token) lleva un id: la explicación animada mueve las MISMAS fichas de un estado al siguiente
   (hacia: «esta ficha se funde en el resultado r0», de: «el resultado aparece desde esta ficha»).
   ========================================================= */
(function (global) {

    var MUL = '×', MAS = '+', MEN = '−', DIV = '÷';
    var ROLES = ['a', 'b', 'c', 'e'];

    function azar(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function elegir(l) { return l[Math.floor(Math.random() * l.length)]; }
    function barajar(l) { l = l.slice(); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; } return l; }

    /* ---------- fichas ---------- */
    function T(k, v, rol, id) { return { k: k, v: String(v), rol: rol || '', id: id || '' }; }
    function num(v, rol, id) { return T('n', v, rol, id); }
    function ope(v, id) { return T('o', v, '', id); }
    function par(v, id) { return T('p', v, '', id); }
    function con(t, extra) { for (var k in extra) t[k] = extra[k]; return t; }
    function clon(t) { var c = {}; for (var k in t) c[k] = t[k]; return c; }
    function limpio(t) { var c = clon(t); delete c.hacia; delete c.de; return c; }
    function esNum(t) { return t && t.k === 'n' && /^[0-9]+$/.test(t.v); }

    /* ---------- cuentas ---------- */
    /* null si no sale un natural (resta negativa, división no exacta) */
    function calc(x, o, y) {
        var r = o === MAS ? x + y : o === MEN ? x - y : o === MUL ? x * y : (y !== 0 && x % y === 0 ? x / y : null);
        return r != null && r >= 0 && Math.floor(r) === r ? r : null;
    }
    function clase(o) { return o === MUL || o === DIV ? 2 : 1; }

    /* índice del operador del siguiente paso: el primer paréntesis; si no, la primera × ÷; si no, la primera + − (null si no queda nada) */
    function siguientePaso(t) {
        var i, c = -1;
        for (i = 0; i < t.length; i++) if (t[i].k === 'p' && t[i].v === '(') return i + 2;
        for (i = 0; i < t.length; i++) if (t[i].k === 'o' && clase(t[i].v) === 2) { c = i; break; }
        if (c < 0) for (i = 0; i < t.length; i++) if (t[i].k === 'o') { c = i; break; }
        return c < 0 ? null : c;
    }
    /* las fichas que ocupa la operación del operador c (con su paréntesis, si lo tiene) */
    function rango(t, c) {
        var dentro = t[c - 2] && t[c - 2].k === 'p' && t[c - 2].v === '(' && t[c + 2] && t[c + 2].k === 'p' && t[c + 2].v === ')';
        return dentro ? [c - 2, c + 2] : [c - 1, c + 1];
    }
    /* resuelve la operación del operador c: el resultado ocupa el sitio de sus fichas */
    function reducir(t, c, rid) {
        var r = rango(t, c), x = t[c - 1], y = t[c + 1];
        var v = calc(Number(x.v), t[c].v, Number(y.v));
        var res = con(num(v, 'r', rid), { de: x.id });
        return { valor: v, estado: t.slice(0, r[0]).concat([res], t.slice(r[1] + 1)), ini: r[0], fin: r[1] };
    }

    /* todos los estados por los que pasa una operación (resolviéndola con la regla del orden), o null si algún paso no es válido */
    function simular(t0) {
        var t = t0.map(limpio), est = [t], pasos = [], k = 0, c;
        while ((c = siguientePaso(t)) != null) {
            var x = t[c - 1], y = t[c + 1];
            if (!esNum(x) || !esNum(y)) return null;
            var r = reducir(t, c, 'r' + k);
            if (r.valor == null) return null;
            var usadas = t.slice(r.ini, r.fin + 1);
            pasos.push({ ids: usadas.map(function (u) { return u.id; }), pp: usadas.map(limpio), x: Number(x.v), o: t[c].v, y: Number(y.v), valor: r.valor, paren: r.fin - r.ini === 4 });
            usadas.forEach(function (u) { if (u.k === 'n') u.hacia = 'r' + k; });      // estos números se funden en el resultado
            t = r.estado.map(clon);
            est.push(t);
            if (++k > 10) return null;
        }
        return t.length === 1 && esNum(t[0]) ? { estados: est, pasos: pasos } : null;
    }
    /* los estados sucesivos de una lista cualquiera de fichas (la del alumno incluida), o null si no se puede resolver */
    function cadena(tokens) {
        var t = tokens.map(limpio), out = [t], c, guard = 0;
        while ((c = siguientePaso(t)) != null) {
            if (++guard > 12 || !esNum(t[c - 1]) || !esNum(t[c + 1])) return null;
            var r = reducir(t, c, 'q' + guard);
            if (r.valor == null) return null;
            t = r.estado.map(clon);
            out.push(t);
        }
        return t.length === 1 && esNum(t[0]) ? out : null;
    }
    function evaluar(tokens) { var c = tokens && cadena(tokens); return c ? Number(c[c.length - 1][0].v) : null; }

    /* ---------- vistas de la operación ---------- */
    /* la operación tras k pasos («hacia: r<k>» = estas fichas se fundirán en el resultado verde) */
    function antes(q, k) { return q.estados[k || 0]; }
    /* lo que queda después del paso k (el resultado aparece desde donde estaba su primer número) */
    function siguiente(q, k) { return q.estados[(k || 0) + 1]; }
    /* el paso k (la operación que se resuelve), con su paréntesis si lo tiene */
    function primerPaso(q, k) { return q.pasos[k || 0].pp; }

    /* la misma operación pero empezando en el estado k (para explicar un fallo en «Paso a paso» a partir de ese punto) */
    function desde(q, k) {
        if (!k) return q;
        var d = {}, p;
        for (p in q) d[p] = q[p];
        d.estados = q.estados.slice(k); d.pasos = q.pasos.slice(k); d.n = q.n - k;
        d.tokens = d.estados[0];
        d.clave = 'desde' + k + ' ' + texto(d.tokens);
        d.calc = { primero: d.pasos[0].valor, total: q.calc.total };
        return d;
    }

    /* ---------- texto y voz ---------- */
    function texto(tokens) {
        var s = '';
        tokens.forEach(function (t) { s += t.k === 'o' ? ' ' + t.v + ' ' : t.v; });
        return s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
    }
    function textoHTML(tokens, colores) {
        var s = '';
        tokens.forEach(function (t) { s += t.k === 'o' ? ' ' + t.v + ' ' : (colores && t.rol ? '<b class="rol-' + t.rol + '">' + t.v + '</b>' : t.v); });
        return s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
    }
    function palabraOp(op) { return op === MAS ? 'más' : op === MEN ? 'menos' : op === MUL ? 'por' : 'entre'; }
    function nombreOp(op) { return op === MAS ? 'suma' : op === MEN ? 'resta' : op === MUL ? 'multiplicación' : 'división'; }
    /* cómo se LEE una operación en voz alta: los signos no se leen (la voz los entiende mejor con palabras) y las comas
       dejan pausas alrededor de + y − para que se oiga qué va junto («4, más, 3 por 5») */
    function vozTokens(tokens) {
        var s = '', dentro = false;
        tokens.forEach(function (t) {
            if (t.k === 'n') s += ' ' + t.v;
            else if (t.k === 'o') s += clase(t.v) === 1 && !dentro ? ', ' + palabraOp(t.v) + ',' : ' ' + palabraOp(t.v);
            else { dentro = t.v === '('; s += dentro ? ' el paréntesis de' : ','; }
        });
        return s.replace(/\s+/g, ' ').replace(/,(\s*,)+/g, ',').replace(/\s+,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '');
    }
    function voz(q) { return vozTokens(q.tokens); }

    /* La regla del orden, con los símbolos de colores */
    function regla() {
        return '1.º <b class="rol-a">( )</b> · 2.º <b class="rol-b">' + MUL + ' ' + DIV + '</b> · 3.º <b class="rol-c">' + MAS + ' ' + MEN + '</b> · mismo nivel: de izquierda a derecha';
    }

    /* ---------- generación ---------- */
    /* Cada plantilla es un dibujo de la operación: N = número, o = operación, ( ) = paréntesis.
       ops: las parejas de operaciones que se pueden usar (sin ops, se sortean libres: ver opsLibres) */
    /* niveles: 1 y 2 = 3 números / 2 pasos; 3 = 4 números / 3 pasos */
    var NIV = {
        1: { num: [2, 9], plantillas: [{ nombre: 'pri', p: 'NoNoN', ops: [[MAS, MUL]] }] },
        2: { num: [2, 12], plantillas: [
            { nombre: 'pri', p: 'NoNoN', ops: [[MAS, MUL], [MEN, MUL], [MAS, DIV], [MEN, DIV]] },
            { nombre: 'izq', p: 'NoNoN', ops: [[MEN, MAS], [DIV, MUL]] }
        ] },
        /* nivel 3: siempre 4 números = 3 pasos */
        3: { num: [2, 20], plantillas: [
            { nombre: 'lineal', p: 'NoNoNoN' }, { nombre: 'lineal', p: 'NoNoNoN' },
            { nombre: 'parIzq', p: '(NoN)oNoN' },
            { nombre: 'parMedio', p: 'No(NoN)oN' },
            { nombre: 'parDer', p: 'NoNo(NoN)' },
            { nombre: 'dosPar', p: '(NoN)o(NoN)' }
        ] }
    };

    /* Todo se tiene que poder hacer de cabeza: ningún número ni resultado pasa de 100, las multiplicaciones son de tablas
       (un factor de 10 o menos, producto hasta 100) y se divide entre 10 o menos. */
    var LIMITE = 100;
    function entero(x) { return x != null && isFinite(x) && Math.floor(x) === x && x >= 1 && x <= LIMITE; }
    function facil(p) {
        if (p.o === MUL) return Math.min(p.x, p.y) <= 10 && p.valor <= LIMITE;
        if (p.o === DIV) return p.y <= 10 && p.x <= LIMITE;
        return p.valor <= LIMITE;
    }

    function construir(patron, ops, nums) {
        var t = [], ni = 0, oi = 0, pi = 0;
        patron.split('').forEach(function (ch) {
            if (ch === 'N') { t.push(num(nums[ni], ROLES[ni], 'n' + ni)); ni++; }
            else if (ch === 'o') { t.push(ope(ops[oi], 'x' + oi)); oi++; }
            else t.push(par(ch, 'p' + (pi++)));
        });
        return t;
    }

    /* tres operaciones al azar; sin paréntesis tienen que mezclar los dos niveles (si no, no habría orden que aprender) y ÷ como mucho una vez */
    function opsLibres(patron) {
        var pool = [MAS, MEN, MUL, MUL, DIV], ops = [], divs = 0, i;
        for (i = 0; i < 3; i++) { var o = elegir(pool); if (o === DIV && divs++ >= 1) o = MUL; ops.push(o); }
        var cl = ops.map(clase);
        if (patron.indexOf('(') < 0 && (cl.indexOf(1) < 0 || cl.indexOf(2) < 0)) return null;
        return ops;
    }

    function intento(nivel, pl, ops) {
        var N = NIV[nivel], n = pl.p.replace(/[^N]/g, '').length, nums = [], i, j;
        ops = ops || opsLibres(pl.p);
        if (!ops) return null;
        for (i = 0; i < n; i++) nums.push(azar(N.num[0], N.num[1]));
        var t0 = construir(pl.p, ops, nums), sim = simular(t0);
        if (!sim || !sim.pasos.every(facil)) return null;
        /* los números y los resultados: naturales y distintos (los intermedios, de 2 en adelante) */
        var v = nums.concat(sim.pasos.map(function (p) { return p.valor; }));
        for (i = 0; i < v.length; i++) if (!entero(v[i]) || (i >= n && i < v.length - 1 && v[i] < 2)) return null;
        for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++) if (v[i] === v[j]) return null;
        /* si hay paréntesis tienen que servir para algo: sin ellos tendría que dar otro resultado */
        if (pl.p.indexOf('(') >= 0) {
            var plano = evaluar(t0.filter(function (t) { return t.k !== 'p'; }));
            if (plano === sim.pasos[sim.pasos.length - 1].valor) return null;
        }
        return { forma: pl.nombre, nivel: nivel, numeros: nums, n: sim.pasos.length, estados: sim.estados, pasos: sim.pasos };
    }

    function preparar(q) {
        q.tokens = q.estados[0];
        q.calc = { primero: q.pasos[0].valor, total: q.pasos[q.pasos.length - 1].valor };
        q.clave = texto(q.tokens);
        return q;
    }

    function generar(nivel, nombre) {
        if (!NIV[nivel]) nivel = elegir([1, 2, 3]);
        var N = NIV[nivel], cand = nombre ? N.plantillas.filter(function (p) { return p.nombre === nombre; }) : N.plantillas;
        if (!cand.length) cand = N.plantillas;
        for (var ronda = 0; ronda < 8; ronda++) {
            var pl = elegir(cand), ops = pl.ops ? elegir(pl.ops) : null;      // la pareja de operaciones se fija en cada ronda
            for (var i = 0; i < 1500; i++) {
                var q = intento(nivel, pl, ops);
                if (q) { preparar(q); if (listo(q)) return q; }
            }
        }
        return generar(1);
    }

    /* la pregunta se puede plantear: hay 3 opciones (1 buena y 2 malas) en todas las actividades */
    function listo(q) {
        if (opcionesPrimero(q).length !== 3) return false;
        for (var k = 0; k < q.n; k++) if (opcionesPasos(q, k).length !== 3) return false;
        return true;
    }

    /* ---------- los pasos «tramposos» ---------- */
    /* Todas las parejas de números (de la operación sin paréntesis) con una operación, menos el primer paso de verdad.
       propio = la pareja está seguida (a op b) y lleva su operación: es el error clásico de empezar por donde no toca.
       todas: con las cuatro operaciones (si no, solo las que aparecen en la operación) */
    function candidatos(q, todas) {
        var plano = q.tokens.filter(function (t) { return t.k !== 'p'; });
        var opCorrecta = q.pasos[0].pp.filter(function (t) { return t.k === 'o'; })[0].id;
        var ops = todas ? [MAS, MEN, MUL, DIV] : [];
        plano.forEach(function (t) { if (!todas && t.k === 'o' && ops.indexOf(t.v) < 0) ops.push(t.v); });
        var l = [], i, j;
        for (i = 0; i < plano.length; i += 2) for (j = i + 2; j < plano.length; j += 2) {
            ops.forEach(function (o) {
                var propio = j === i + 2 && plano[i + 1].v === o;
                if (propio && plano[i + 1].id === opCorrecta) return;       // este es el primer paso bueno
                var v = calc(Number(plano[i].v), o, Number(plano[j].v));
                if (v != null && v > LIMITE) return;                         // ni las opciones malas llevan cuentas que no sean de cabeza
                l.push({ i: i, j: j, o: o, propio: propio, plano: plano, v: v });
            });
        }
        return l;
    }
    /* lo que queda si se empezara por esa pareja: el resultado ocupa el sitio del primer número, el segundo desaparece con su operación
       y los paréntesis que no se han tocado se quedan */
    function resto(q, c) {
        var x = c.plano[c.i], y = c.plano[c.j], v = calc(Number(x.v), c.o, Number(y.v));
        if (v == null) return null;
        var r = c.plano.map(limpio);
        r[c.i] = con(num(v, 'd', 'w'), { de: x.id });
        r.splice(c.j - 1, 2);
        q.tokens.forEach(function (t, h) {
            if (t.k !== 'p' || t.v !== '(') return;
            var a = q.tokens[h + 1].id, b = q.tokens[h + 2].id, d = q.tokens[h + 3].id;
            for (var s = 0; s + 2 < r.length; s++) {
                if (r[s].id === a && r[s + 1].id === b && r[s + 2].id === d) { r.splice(s + 3, 0, limpio(q.tokens[h + 4])); r.splice(s, 0, limpio(t)); break; }
            }
        });
        return { tokens: r, valor: v };
    }
    /* lo mismo, con su resultado final (null si no se puede acabar) */
    function consecuencia(q, c) {
        var r = resto(q, c);
        if (!r) return null;
        var cad = cadena(r.tokens);
        return { tokens: r.tokens, cadena: cad ? cad.map(texto) : null, valor: cad ? Number(cad[cad.length - 1][0].v) : null };
    }
    /* los malos ordenados: los «propios» primero, luego los de resultado razonable y al final los demás; mezclados dentro de cada grupo */
    function ordenar(l, q) {
        function razonable(x) { return x.f == null || x.f <= Math.min(LIMITE, 4 * q.calc.total + 20); }
        var resto = l.filter(function (x) { return !x.c.propio; });
        return barajar(l.filter(function (x) { return x.c.propio; })).concat(barajar(resto.filter(razonable)), barajar(resto.filter(function (x) { return !razonable(x); })));
    }

    /* ---------- actividad «¿Cuál va primero?» ---------- */
    function opcionesPrimero(q) {
        var total = q.calc.total, buenos = [], raros = [];
        candidatos(q).forEach(function (c) {
            var cons = consecuencia(q, c);
            if (cons && cons.valor === total) return;             // empezar por ahí también vale (operaciones independientes): no se ofrece
            if (cons && cons.valor != null && cons.valor > LIMITE) cons = null;      // no se explica con resultados disparatados
            var o = { tokens: [limpio(c.plano[c.i]), ope(c.o, c.propio ? c.plano[c.i + 1].id : 'w'), limpio(c.plano[c.j])], ok: false, cons: cons && cons.valor != null ? cons : null };
            o.texto = texto(o.tokens);
            (cons ? buenos : raros).push({ c: c, o: o, f: cons ? cons.valor : null });
        });
        var correcta = { tokens: q.pasos[0].pp.map(limpio), ok: true };
        correcta.texto = texto(correcta.tokens);
        var vistos = {}; vistos[correcta.texto] = 1;
        var malas = ordenar(buenos, q).concat(barajar(raros)).map(function (x) { return x.o; }).filter(function (o) { if (vistos[o.texto]) return false; vistos[o.texto] = 1; return true; });
        return barajar([correcta].concat(malas.slice(0, 2)));
    }

    /* ---------- actividades «Elige la igualdad» y «Paso a paso» ---------- */
    /* ¿cómo queda la operación después de su primer paso? (1 buena y 2 malas) */
    function opcionesIgualdad(q) {
        var total = q.calc.total, buenos = [];
        var correcta = { tokens: q.estados[1].map(limpio), ok: true };
        correcta.texto = texto(correcta.tokens);
        var vistos = {}; vistos[correcta.texto] = 1;
        candidatos(q).forEach(function (c) {
            var cons = consecuencia(q, c);
            if (!cons || cons.valor == null || cons.valor === total || cons.valor > LIMITE) return;
            var o = { tokens: cons.tokens, ok: false, valor: cons.valor, texto: texto(cons.tokens) };
            if (!vistos[o.texto]) { vistos[o.texto] = 1; buenos.push({ c: c, o: o, f: cons.valor }); }
        });
        return barajar([correcta].concat(ordenar(buenos, q).slice(0, 2).map(function (x) { return x.o; })));
    }
    /* la operación ya está reducida a una cuenta: ¿cuánto vale? (1 buena y 2 malas) */
    function opcionesValor(q) {
        var total = q.calc.total, malos = [], vistos = {};
        function nuevo(v) { return { tokens: [num(v, 'd', 'w' + malos.length)], ok: false, valor: v, texto: String(v) }; }
        vistos[total] = 1;
        /* los resultados de los errores típicos, de los más cercanos al total a los más disparatados (nada de 1550 para un 145) */
        var posibles = [];
        candidatos(q, true).forEach(function (c) {
            var cons = consecuencia(q, c);
            if (cons && cons.valor != null && cons.valor <= Math.min(LIMITE, 2 * total + 10) && !vistos[cons.valor]) { vistos[cons.valor] = 1; posibles.push(cons.valor); }
        });
        posibles.sort(function (a, b) { return Math.abs(a - total) - Math.abs(b - total); }).slice(0, 2).forEach(function (v) { malos.push(nuevo(v)); });
        /* último recurso: total ± algo (son números sueltos, así que un «casi» vale perfectamente) */
        for (var k = 1; malos.length < 2 && k <= 5; k++) {
            [total + k, total - k].forEach(function (v) {
                if (malos.length >= 2 || v < 0 || v > LIMITE || vistos[v]) return;
                vistos[v] = 1; malos.push(nuevo(v));
            });
        }
        return barajar([{ tokens: [num(total, 'r', 'r')], ok: true, valor: total, texto: String(total) }].concat(malos.slice(0, 2)));
    }
    /* estado = el paso por el que va la operación (0 = entera); en el último solo queda decir cuánto vale */
    function opcionesPasos(q, estado) {
        var d = desde(q, estado || 0);
        return d.n <= 1 ? opcionesValor(d) : opcionesIgualdad(d);
    }

    /* ---------- arrastrar: plantilla, bandeja y comprobación ---------- */
    /* lo que se monta: lo que queda tras el primer paso. Los números y las operaciones son huecos; los paréntesis ya están puestos */
    function plantillaArrastre(q) {
        var N = NIV[q.nivel] || NIV[1], vistos = {}, esencial = [], extra = [], est0 = q.estados[0];
        function poner(l, v) { if (v != null && Math.floor(v) === v && v >= 1 && v <= LIMITE && !vistos[v]) { vistos[v] = 1; l.push(v); } }
        /* imprescindibles: los números de lo que queda (los intactos y el resultado del primer paso) */
        q.estados[1].forEach(function (t) { if (t.k === 'n') poner(esencial, Number(t.v)); });
        /* los demás: los números de la operación, el total y los resultados de los pasos tramposos */
        est0.forEach(function (t) { if (t.k === 'n') poner(extra, Number(t.v)); });
        poner(extra, q.calc.total);
        candidatos(q).forEach(function (c) { var r = resto(q, c); if (r) poner(extra, r.valor); });
        var total = est0.filter(function (t) { return t.k === 'n'; }).length + 3, l = esencial.concat(barajar(extra));
        l = l.slice(0, Math.max(total, esencial.length));
        for (var n = 0; l.length < total && n < 80; n++) { var v = azar(N.num[0], N.num[1]); if (!vistos[v]) { vistos[v] = 1; l.push(v); } }
        return {
            tipo: 'paso',
            huecos: q.estados[1].filter(function (t) { return t.k !== 'p'; }).length,
            forma: q.estados[1].map(function (t) { return t.k === 'p' ? { k: 'p', v: t.v } : { k: t.k }; }),
            bandeja: barajar(l)
        };
    }
    /* lo que debería quedar, hueco a hueco: [número, operación, número, …] */
    function pasoEsperado(q) {
        return q.estados[1].filter(function (t) { return t.k !== 'p'; }).map(function (t) { return t.v; });
    }
    /* la plantilla rellena con lo que ha puesto el alumno, como fichas */
    function rellenar(q, s) {
        var i = 0;
        return q.estados[1].map(function (t) {
            if (t.k === 'p') return par(t.v, t.id);
            var v = s[i] == null || s[i] === '' ? '?' : String(s[i]), id = 'f' + i;
            i++;
            return /^[0-9]+$/.test(v) ? num(v, rolDe(q, v), id) : ope(v, id);
        });
    }
    function ordenado(l) { return l.slice().sort(); }
    function comprobarArrastre(q, s) {
        var e = pasoEsperado(q);
        if (!s || s.length !== e.length || s.some(function (x) { return x == null || x === ''; })) return false;
        s = s.map(String);
        if (s.every(function (v, i) { return v === e[i]; })) return true;
        /* los mismos números y las mismas operaciones en otro orden que dé lo mismo (4 × 5 + 6 en vez de 6 + 4 × 5) */
        var nS = s.filter(function (v, i) { return i % 2 === 0; }), nE = e.filter(function (v, i) { return i % 2 === 0; });
        var oS = s.filter(function (v, i) { return i % 2 === 1; }), oE = e.filter(function (v, i) { return i % 2 === 1; });
        if (ordenado(nS).join() !== ordenado(nE).join() || ordenado(oS).join() !== ordenado(oE).join()) return false;
        return evaluar(rellenar(q, s)) === q.calc.total;
    }
    /* lo que ha montado el alumno, como fichas (para mostrarlo en la explicación) */
    function rolDe(q, v) {
        v = Number(v);
        var rol = '';
        q.estados[0].forEach(function (t) { if (!rol && t.k === 'n' && Number(t.v) === v) rol = t.rol; });
        if (rol) return rol;
        return q.pasos.some(function (p) { return p.valor === v; }) ? 'r' : 'd';
    }
    function fichasArrastre(q, s) { return rellenar(q, s); }

    /* ---------- nota de respuesta (debajo del tablero) ---------- */
    function nota(q) {
        var cuentas = q.estados.map(texto);
        cuentas[cuentas.length - 1] = '<b>' + cuentas[cuentas.length - 1] + '</b>';
        return '<b>' + textoHTML(q.pasos[0].pp, true) + '</b> va primero: ' + cuentas.join(' = ');
    }

    global.Op = {
        MUL: MUL, MAS: MAS, MEN: MEN, DIV: DIV, NIVELES: NIV,
        generar: generar, desde: desde, antes: antes, siguiente: siguiente, primerPaso: primerPaso,
        texto: texto, textoHTML: textoHTML, voz: voz, vozTokens: vozTokens, regla: regla,
        palabraOp: palabraOp, nombreOp: nombreOp, evaluar: evaluar, cadena: cadena,
        opcionesPrimero: opcionesPrimero, opcionesIgualdad: opcionesIgualdad, opcionesValor: opcionesValor, opcionesPasos: opcionesPasos,
        plantillaArrastre: plantillaArrastre, pasoEsperado: pasoEsperado, comprobarArrastre: comprobarArrastre,
        fichasArrastre: fichasArrastre, nota: nota,
        barajar: barajar, azar: azar, elegir: elegir
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = global.Op;

})(typeof window !== 'undefined' ? window : globalThis);
