// ===== 3D Print Manager - Frontend Logic v3 =====

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initCalculator();
    initLocalStoragePersistence();
    initToasts();
    initButtonFeedback();

    requestAnimationFrame(() => {
        document.body.classList.remove('no-transitions');
    });
});

/* ===== THEME ===== */
function initTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }

    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            document.body.classList.toggle('dark', isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    });
}

/* ===== MOBILE MENU ===== */
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('hidden');
    });
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
        });
    }
}

/* ===== LOCALSTORAGE PERSISTENCE ===== */
function initLocalStoragePersistence() {
    // Fields to persist: filament price, depreciation, labor, risk, margin
    const persistFields = [
        { id: 'filament_price_kg', key: 'pm_filament_price_kg' },
        { id: 'depreciation_per_hour', key: 'pm_depreciation_per_hour' },
        { id: 'labor_per_hour', key: 'pm_labor_per_hour' },
        { id: 'risk_rate', key: 'pm_risk_rate' },
        { id: 'margin_percent', key: 'pm_margin_percent' },
    ];

    persistFields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (!el) return;

        // Restore saved value (only if user has previously saved one)
        const saved = localStorage.getItem(key);
        if (saved !== null && saved !== '') {
            el.value = saved;
        }

        // Save on every change
        el.addEventListener('input', () => {
            localStorage.setItem(key, el.value);
        });
    });

    // Recalculate after restoring values
    calculate();
}

/* ===== CALCULATOR ===== */
function initCalculator() {
    const fields = [
        'filament_price_kg', 'piece_weight_g',
        'print_hours', 'print_minutes',
        'manual_hours', 'manual_minutes',
        'depreciation_per_hour', 'labor_per_hour',
        'risk_rate', 'margin_percent'
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculate);
            if (id.includes('minutes')) {
                el.addEventListener('blur', function () {
                    let v = parseInt(this.value) || 0;
                    if (v > 59) { this.value = 59; calculate(); }
                    if (v < 0) { this.value = 0; calculate(); }
                });
            }
        }
    });

    calculate();
}

function getTimeInHours(hoursId, minutesId) {
    const h = parseFloat(document.getElementById(hoursId)?.value) || 0;
    const m = parseFloat(document.getElementById(minutesId)?.value) || 0;
    return h + (m / 60);
}

function calculate() {
    const filamentPriceKg = parseFloat(document.getElementById('filament_price_kg')?.value) || 0;
    const pieceWeightG    = parseFloat(document.getElementById('piece_weight_g')?.value) || 0;
    const printTimeH      = getTimeInHours('print_hours', 'print_minutes');
    const manualTimeH     = getTimeInHours('manual_hours', 'manual_minutes');
    const depreciationH   = parseFloat(document.getElementById('depreciation_per_hour')?.value) || 0;
    const laborH          = parseFloat(document.getElementById('labor_per_hour')?.value) || 0;
    const riskRate        = parseFloat(document.getElementById('risk_rate')?.value) || 0;
    const marginPercent   = parseFloat(document.getElementById('margin_percent')?.value) || 0;

    const energyTariff       = 0.85;
    const printerConsumption = 0.12;

    const filamentCost     = (pieceWeightG / 1000) * filamentPriceKg;
    const energyCost       = printTimeH * printerConsumption * energyTariff;
    const depreciationCost = printTimeH * depreciationH;
    const laborCost        = manualTimeH * laborH;
    const subtotal         = filamentCost + energyCost + depreciationCost + laborCost;
    const riskCost         = subtotal * (riskRate / 100);
    const totalCost        = subtotal + riskCost;

    const finalPrice = totalCost * (1 + marginPercent / 100);
    const price100   = totalCost * 2;
    const price200   = totalCost * 3;
    const price400   = totalCost * 5;

    // Hidden fields for form submission
    setHidden('print_time_h', printTimeH.toFixed(4));
    setHidden('manual_time_h', manualTimeH.toFixed(4));

    // Display
    setVal('res_filament', filamentCost);
    setVal('res_energy', energyCost);
    setVal('res_depreciation', depreciationCost);
    setVal('res_labor', laborCost);
    setVal('res_subtotal', subtotal);
    setVal('res_risk', riskCost);
    setVal('res_total', totalCost);
    setVal('res_final_price', finalPrice);
    setVal('res_price100', price100);
    setVal('res_price200', price200);
    setVal('res_price400', price400);

    // Dynamic risk label
    const riskLabel = document.getElementById('risk_label');
    if (riskLabel) riskLabel.textContent = `(${riskRate}%)`;

    // Dynamic margin label
    const marginLabel = document.getElementById('margin_label');
    if (marginLabel) marginLabel.textContent = `${marginPercent}%`;

    // Time labels
    setTimeLabel('print_time_label', printTimeH);
    setTimeLabel('manual_time_label', manualTimeH);
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = 'R$ ' + value.toFixed(2);
}

function setHidden(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function setTimeLabel(id, hours) {
    const el = document.getElementById(id);
    if (!el) return;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) el.textContent = '';
    else if (h === 0) el.textContent = `= ${m}min`;
    else if (m === 0) el.textContent = `= ${h}h`;
    else el.textContent = `= ${h}h ${m}min`;
}

/* ===== TOASTS ===== */
function initToasts() {
    const params = new URLSearchParams(window.location.search);
    let msg = null;

    if (params.has('saved'))          msg = '✅ Orçamento salvo com sucesso!';
    if (params.has('deleted'))        msg = '🗑️ Item removido!';
    if (params.has('cleared'))        msg = '🧹 Histórico limpo!';
    if (params.has('added'))          msg = '✅ Item adicionado!';
    if (params.has('settings_saved')) msg = '⚙️ Configurações atualizadas!';

    if (msg) {
        showToast(msg);
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

/* ===== BUTTON FEEDBACK ===== */
function initButtonFeedback() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.95)');
        btn.addEventListener('mouseup', () => btn.style.transform = '');
        btn.addEventListener('mouseleave', () => btn.style.transform = '');
    });
}

/* ===== CONFIRMS ===== */
function confirmDelete(msg) {
    return confirm(msg || 'Tem certeza que deseja remover este item?');
}
function confirmClear() {
    return confirm('⚠️ Isso removerá TODOS os orçamentos do histórico. Continuar?');
}

