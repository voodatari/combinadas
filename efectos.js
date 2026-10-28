// --- EFECTOS VISUALES Y UTILIDADES DE INTERFAZ ---

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* Reinicia una animación de CSS. La clase se quita sola al acabar: si se quedara puesta, la animación volvería a ejecutarse cada vez que
   el elemento reaparece (p. ej. la sacudida de «fallo» del tablero al empezar una partida nueva tras acabar la anterior en error). */
function restartAnimation(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;   // fuerza reflow para reiniciar la animación
    el.classList.add(className);
    if (el._finAnim) el.removeEventListener('animationend', el._finAnim);
    el._finAnim = function (e) {
        if (e.target !== el) return;
        el.classList.remove(className);
        el.removeEventListener('animationend', el._finAnim);
        el._finAnim = null;
    };
    el.addEventListener('animationend', el._finAnim);
}

// --- Avisos flotantes ---
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var box = document.getElementById('toast-container');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toast-container';
        document.body.appendChild(box);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    box.appendChild(toast);
    setTimeout(function () {
        toast.classList.add('toast-out');
        setTimeout(function () { toast.remove(); }, 400);
    }, duration);
}

// --- Confeti ---
function launchConfetti(amount) {
    amount = amount || 120;
    if (document.documentElement.classList.contains('ligero')) amount = Math.round(amount / 3);
    var colors = ['#f15bb5', '#fee440', '#00f5d4', '#00bbf9', '#9d4edd', '#e0aaff'];
    var layer = document.createElement('div');
    layer.className = 'confetti-layer';
    for (var i = 0; i < amount; i++) {
        var piece = document.createElement('i');
        piece.style.setProperty('--x', (Math.random() * 100).toFixed(2) + 'vw');
        piece.style.setProperty('--drift', (Math.random() * 30 - 15).toFixed(2) + 'vw');
        piece.style.setProperty('--rot', Math.round(Math.random() * 1440 - 720) + 'deg');
        piece.style.setProperty('--delay', (Math.random() * 0.7).toFixed(2) + 's');
        piece.style.setProperty('--dur', (2.2 + Math.random() * 1.8).toFixed(2) + 's');
        piece.style.background = colors[i % colors.length];
        if (i % 3 === 0) piece.style.borderRadius = '50%';
        layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 5000);
}

// --- Cuenta atrás 3, 2, 1, ¡YA! ---
var countdownActive = false;

function showCountdown(onDone, headerHTML) {
    if (countdownActive) return;
    countdownActive = true;

    var overlay = document.createElement('div');
    overlay.id = 'countdown-overlay';
    overlay.innerHTML = (headerHTML || '') + '<div class="countdown-number"></div>';
    document.body.appendChild(overlay);

    var numberEl = overlay.querySelector('.countdown-number');
    var steps = ['3', '2', '1', '¡YA!'];
    var index = 0;

    function tick() {
        if (index >= steps.length) {
            overlay.classList.add('countdown-out');
            setTimeout(function () { overlay.remove(); }, 300);
            countdownActive = false;
            onDone();
            return;
        }
        numberEl.textContent = steps[index];
        numberEl.classList.toggle('go', index === steps.length - 1);
        restartAnimation(numberEl, 'count-pop');
        if (index < steps.length - 1) Sonido.efecto('click', 0.4);
        index++;
        setTimeout(tick, index === steps.length ? 320 : 480);
    }
    tick();
}

// --- Texto flotante (+10) sobre un elemento ---
function floatText(text, anchorEl, className) {
    if (!anchorEl || typeof anchorEl.getBoundingClientRect !== 'function') return;
    var rect = anchorEl.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'float-text ' + (className || 'float-good');
    el.textContent = text;
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 950);
}

// --- Contador animado ---
function animateCount(el, to, duration) {
    if (!el) return;
    duration = duration || 900;
    var start = performance.now();
    function step(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- Racha de aciertos ---
function updateStreak(count) {
    var badge = document.getElementById('streak-badge');
    if (!badge) return;
    if (count >= 3) {
        badge.textContent = '🔥 Racha x' + count;
        badge.classList.add('visible');
        restartAnimation(badge, 'streak-pop');
    } else {
        badge.classList.remove('visible');
    }
}

// --- Cuadros de diálogo propios (sustituyen a confirm / alert del navegador) ---
// Devuelven una promesa: confirmDialog → true/false, alertDialog → true.
function showDialog(opts) {
    opts = opts || {};
    var title = opts.title || '', message = opts.message || '', icon = opts.icon || '';
    var okText = opts.okText || 'Aceptar';
    var cancelText = opts.cancelText === undefined ? 'Cancelar' : opts.cancelText;
    var danger = !!opts.danger;

    return new Promise(function (resolve) {
        var previousFocus = document.activeElement;
        var overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.innerHTML =
            '<div class="dialog-box" role="dialog" aria-modal="true">' +
                (icon ? '<div class="dialog-icon">' + icon + '</div>' : '') +
                (title ? '<h3 class="dialog-title">' + esc(title) + '</h3>' : '') +
                (message ? '<p class="dialog-message">' + esc(message).replace(/\n/g, '<br>') + '</p>' : '') +
                '<div class="dialog-actions">' +
                    (cancelText ? '<button type="button" class="btn-secondary dialog-cancel">' + esc(cancelText) + '</button>' : '') +
                    '<button type="button" class="btn-primary dialog-ok' + (danger ? ' danger' : '') + '">' + esc(okText) + '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        var okButton = overlay.querySelector('.dialog-ok');
        var cancelButton = overlay.querySelector('.dialog-cancel');

        function close(value) {
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('dialog-out');
            setTimeout(function () { overlay.remove(); }, 200);
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(value);
        }
        // Escape y Enter se atienden aquí y no llegan al resto de la página
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(!cancelText); }
            else if (e.key === 'Enter' && document.activeElement !== cancelButton) { e.preventDefault(); e.stopPropagation(); close(true); }
        }
        document.addEventListener('keydown', onKey, true);
        okButton.addEventListener('click', function () { Sonido.efecto('click'); close(true); });
        if (cancelButton) cancelButton.addEventListener('click', function () { Sonido.efecto('click'); close(false); });
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(!cancelText); });
        setTimeout(function () { okButton.focus(); }, 50);
    });
}

function confirmDialog(message, options) { return showDialog(Object.assign({ message: message }, options || {})); }
function alertDialog(message, options) { return showDialog(Object.assign({ message: message, cancelText: '' }, options || {})); }

/* Ventanas (.modal-overlay: opciones, cambiar nombre): se cierran con la animación inversa a la de abrir */
function cerrarModal(m) {
    if (!m || m.classList.contains('hidden') || m.classList.contains('cerrando')) return;
    m.classList.add('cerrando');
    setTimeout(function () { m.classList.add('hidden'); m.classList.remove('cerrando'); }, 220);
}
function abrirModal(m) { if (m) { m.classList.remove('cerrando'); m.classList.remove('hidden'); } }
