// ═══════════════════════════════════════════════════════════════
//  RELOAD DE ORÇAMENTO via sessionStorage (vindo do Histórico)
//  Lê os dados salvos, preenche os campos e marca como "edição"
// ═══════════════════════════════════════════════════════════════
(function reloadFromSession() {
    const raw = sessionStorage.getItem('reload_budget');
    if (!raw) return;
    sessionStorage.removeItem('reload_budget'); // só uma vez

    let d;
    try { d = JSON.parse(raw); } catch (e) { console.error('[reload] JSON inválido', e); return; }
    if (!d || !d.id) return;

    console.log('[reload] preenchendo orçamento ID', d.id, d);

    // Aguarda DOM pronto
    const fill = () => {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        // Campos básicos
        setVal('piece_name_input', d.piece_name || '');
        setVal('print_time_h', Math.floor(d.print_time_h || 0));
        setVal('print_time_min', Math.round(((d.print_time_h || 0) % 1) * 60));
        setVal('manual_time_h', Math.floor(d.manual_time_h || 0));
        setVal('manual_time_min', Math.round(((d.manual_time_h || 0) % 1) * 60));
        setVal('depreciation_per_hour', d.depreciation_per_hour);
        setVal('labor_per_hour', d.labor_per_hour);
        setVal('risk_rate', d.risk_rate);
        setVal('margin_percent', d.margin_percent);
        setVal('value_multiplier', d.value_multiplier);
        setVal('lot_quantity', d.lot_quantity || 1);

        // ── FILAMENTOS ──
        if (Array.isArray(d.filaments) && d.filaments.length) {
            // Remove filamentos existentes (exceto o primeiro placeholder)
            const filContainer = document.getElementById('filaments-container') || document.querySelector('[data-filaments-container]');
            const addFilBtn = document.querySelector('[data-add-filament], #btn-add-filament, button[onclick*="addFilament"]');

            // Limpa filamentos atuais
            if (filContainer) {
                const existing = filContainer.querySelectorAll('.filament-row, [data-filament-row]');
                existing.forEach((row, i) => { if (i > 0) row.remove(); });
            }

            d.filaments.forEach((f, idx) => {
                if (idx > 0 && addFilBtn) addFilBtn.click();
                setTimeout(() => {
                    const rows = document.querySelectorAll('.filament-row, [data-filament-row]');
                    const row = rows[idx];
                    if (!row) return;
                    const priceInput = row.querySelector('[name*="price"], [data-filament-price]');
                    const weightInput = row.querySelector('[name*="weight"], [data-filament-weight]');
                    if (priceInput) priceInput.value = f.price_kg || 0;
                    if (weightInput) weightInput.value = f.weight_g || 0;
                    priceInput?.dispatchEvent(new Event('input', { bubbles: true }));
                    weightInput?.dispatchEvent(new Event('input', { bubbles: true }));
                }, 100 * (idx + 1));
            });
        }

        // ── INSUMOS ──
        if (Array.isArray(d.supplies) && d.supplies.length) {
            const addSupBtn = document.querySelector('[data-add-supply], #btn-add-supply, button[onclick*="addSupply"]');
            d.supplies.forEach((s, idx) => {
                if (addSupBtn) addSupBtn.click();
                setTimeout(() => {
                    const rows = document.querySelectorAll('.supply-row, [data-supply-row]');
                    const row = rows[idx];
                    if (!row) return;
                    const nameI = row.querySelector('[name*="name"], [data-supply-name]');
                    const priceI = row.querySelector('[name*="price"], [data-supply-price]');
                    const qtyI = row.querySelector('[name*="qty"], [data-supply-qty]');
                    const useI = row.querySelector('[name*="use"], [data-supply-use]');
                    if (nameI) nameI.value = s.name || '';
                    if (priceI) priceI.value = s.price || 0;
                    if (qtyI) qtyI.value = s.qty_pack || 1;
                    if (useI) useI.value = s.use || 1;
                    [nameI, priceI, qtyI, useI].forEach(el => el?.dispatchEvent(new Event('input', { bubbles: true })));
                }, 100 * (idx + 1));
            });
        }

        // ── MARCA COMO EDIÇÃO (cria/seta hidden) ──
        let editingIdInput = document.getElementById('editing_budget_id');
        if (!editingIdInput) {
            editingIdInput = document.createElement('input');
            editingIdInput.type = 'hidden';
            editingIdInput.id = 'editing_budget_id';
            editingIdInput.name = 'editing_budget_id';
            document.body.appendChild(editingIdInput);
        }
        editingIdInput.value = d.id;

        // Banner visual de "editando"
        showEditingBanner(d.piece_name || 'orçamento', d.id);

        // Dispara recálculo
        setTimeout(() => {
            document.querySelectorAll('input').forEach(el => el.dispatchEvent(new Event('input', { bubbles: true })));
        }, 800);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fill);
    } else {
        fill();
    }
})();

function showEditingBanner(name, id) {
    if (document.getElementById('editing-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'editing-banner';
    banner.className = 'mb-4 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-center justify-between text-sm';
    banner.innerHTML = `
        <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span><strong>Editando:</strong> ${name} (ID #${id}) — ao salvar, o orçamento existente será atualizado.</span>
        </div>
        <button type="button" onclick="cancelEditing()" class="text-xs font-bold px-2 py-1 rounded hover:bg-amber-500/20">Cancelar edição</button>
    `;
    const target = document.querySelector('.card') || document.querySelector('main') || document.body;
    target.parentNode.insertBefore(banner, target);
}

function cancelEditing() {
    document.getElementById('editing_budget_id')?.remove();
    document.getElementById('editing-banner')?.remove();
    location.reload();
}
// ===== 3D Print Manager - Frontend Logic v7 (dashboard.html) =====
// Compatível com multi-filamento + insumos persistidos + reload de orçamento

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initSpoolsData();
    addFilamentRow();
    initReloadFromURL();
    initCalculator();
    initSupplies();
    initValueMultiplier();
    initSimulator();
    initLocalStoragePersistence();
    initFormSubmit();
    initToasts();
    initButtonFeedback();

    loadDashboardData();

    requestAnimationFrame(() => {
        document.body.classList.remove('no-transitions');
    });
});

// ═══════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
//  MOBILE MENU
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
//  SPOOLS DATA (carretéis do inventário)
// ═══════════════════════════════════════════
let SPOOLS = [];

async function initSpoolsData() {
    try {
        const el = document.getElementById('spools_data');
        if (el && el.textContent.trim()) {
            const parsed = JSON.parse(el.textContent);
            if (Array.isArray(parsed)) SPOOLS = parsed;
        }
    } catch (e) {
        console.warn('spools_data invalido:', e);
        SPOOLS = [];
    }
    try {
        const res = await fetch('/api/spools', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') } });
        if (res && res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                SPOOLS = data;
                console.log('[SPOOLS] ' + SPOOLS.length + ' carreteis carregados');
                refreshAllSpoolSelects();
            }
        } else {
            console.warn('[SPOOLS] /api/spools status:', res && res.status);
        }
    } catch (e) {
        console.warn('Falha ao buscar /api/spools:', e);
    }
}

// Repopula TODOS os selects de spool ja renderizados
function refreshAllSpoolSelects() {
    document.querySelectorAll('select[id^="fil_spool_"], .spool-select, select[name="spool_id"]').forEach(sel => {
        populateSpoolSelect(sel);
    });
}

// Popula um <select> com a lista de SPOOLS, preservando selecao atual
function populateSpoolSelect(sel) {
    if (!sel) return;
    const current = sel.value;
    const isCalcSelect = sel.id && sel.id.startsWith('fil_spool_');
    let html = isCalcSelect
        ? '<option value="custom">Digitar manualmente</option>'
        : '<option value="">-- Nenhum --</option>';
    SPOOLS.forEach(s => {
        const price = parseFloat(s.price_per_kg || 0).toFixed(2);
        const label = (s.material || '') + ' ' + (s.color || '') + ' - R$ ' + price + '/kg';
        html += '<option value="' + s.id + '"'
              + ' data-price="' + (s.price_per_kg || 0) + '"'
              + ' data-color="' + (s.color_hex || '#ccc') + '"'
              + ' data-name="' + (s.material || '') + ' ' + (s.color || '') + '"'
              + '>' + label + '</option>';
    });
    sel.innerHTML = html;
    if (current && Array.from(sel.options).some(o => o.value === current)) {
        sel.value = current;
    }
}

// Repopula TODOS os selects de spool ja renderizados
function refreshAllSpoolSelects() {
    document.querySelectorAll('select[id^="fil_spool_"], .spool-select, select[name="spool_id"]').forEach(sel => {
        populateSpoolSelect(sel);
    });
}

// Popula um <select> com a lista de SPOOLS, preservando selecao atual
function populateSpoolSelect(sel) {
    if (!sel) return;
    const current = sel.value;
    const isCalcSelect = sel.id && sel.id.startsWith('fil_spool_');
    let html = isCalcSelect
        ? '<option value="custom">Digitar manualmente</option>'
        : '<option value="">-- Nenhum --</option>';
    SPOOLS.forEach(s => {
        const price = parseFloat(s.price_per_kg || 0).toFixed(2);
        const label = (s.material || '') + ' ' + (s.color || '') + ' - R$ ' + price + '/kg';
        html += '<option value="' + s.id + '"'
              + ' data-price="' + (s.price_per_kg || 0) + '"'
              + ' data-color="' + (s.color_hex || '#ccc') + '"'
              + ' data-name="' + (s.material || '') + ' ' + (s.color || '') + '"'
              + '>' + label + '</option>';
    });
    sel.innerHTML = html;
    if (current && Array.from(sel.options).some(o => o.value === current)) {
        sel.value = current;
    }
}

// Repopula TODOS os <select> de spool já renderizados na pagina
function refreshAllSpoolSelects() {
    // Calculadora multi-filament (ids fil_spool_*)
    document.querySelectorAll('select[id^="fil_spool_"]').forEach(sel => {
        populateSpoolSelect(sel);
    });
    // Fila de impressao e outros lugares (.spool-select ou name="spool_id")
    document.querySelectorAll('.spool-select, select[name="spool_id"]').forEach(sel => {
        populateSpoolSelect(sel);
    });
}

// Popula um <select> com a lista de SPOOLS preservando a selecao atual
function populateSpoolSelect(sel) {
    if (!sel) return;
    const current = sel.value;
    const isCalcSelect = sel.id && sel.id.startsWith('fil_spool_');
    let html = '';
    if (isCalcSelect) {
        html = '<option value="custom">Digitar manualmente</option>';
    } else {
        html = '<option value="">-- Nenhum --</option>';
    }
    SPOOLS.forEach(s => {
        const price = parseFloat(s.price_per_kg || 0).toFixed(2);
        const label = (s.material || '') + ' ' + (s.color || '') + ' - R$ ' + price + '/kg';
        html += '<option value="' + s.id + '"' +
                ' data-price="' + (s.price_per_kg || 0) + '"' +
                ' data-color="' + (s.color_hex || '#ccc') + '"' +
                ' data-name="' + (s.material || '') + ' ' + (s.color || '') + '"' +
                '>' + label + '</option>';
    });
    sel.innerHTML = html;
    // tenta restaurar selecao anterior
    if (current && Array.from(sel.options).some(o => o.value === current)) {
        sel.value = current;
    }
}

// ═══════════════════════════════════════════
//  MULTI-FILAMENT
// ═══════════════════════════════════════════
let filamentCounter = 0;

function addFilamentRow() {
    const container = document.getElementById('filaments_container');
    if (!container) return;

    const idx = filamentCounter++;
    const row = document.createElement('div');
    row.id = 'filament_row_' + idx;
    row.className = 'filament-row p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-sm';

    let spoolOptions = '<option value="custom">✏️ Digitar manualmente</option>';
    SPOOLS.forEach(s => {
        const label = s.material + ' ' + s.color + ' — R$ ' + parseFloat(s.price_per_kg).toFixed(2) + '/kg';
        spoolOptions += '<option value="' + s.id + '" data-price="' + s.price_per_kg + '" data-color="' + (s.color_hex || '#ccc') + '" data-name="' + s.material + ' ' + s.color + '">' + label + '</option>';
    });

    row.innerHTML =
        '<div class="grid grid-cols-12 gap-2 items-end">' +
            '<div class="col-span-12 sm:col-span-5">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Filamento</label>' +
                '<select id="fil_spool_' + idx + '" onchange="onSpoolChange(' + idx + ')" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none">' +
                    spoolOptions +
                '</select>' +
            '</div>' +
            '<div class="col-span-5 sm:col-span-3">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Preço/KG (R$)</label>' +
                '<input type="number" step="0.01" min="0" value="' + getDefaultFilamentPrice() + '" ' +
                    'id="fil_price_' + idx + '" oninput="recalcFilaments()" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none text-center">' +
            '</div>' +
            '<div class="col-span-5 sm:col-span-3">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Peso (g)</label>' +
                '<input type="number" step="0.1" min="0" value="0" ' +
                    'id="fil_weight_' + idx + '" oninput="recalcFilaments()" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none text-center">' +
            '</div>' +
            '<div class="col-span-2 sm:col-span-1 flex flex-col items-center justify-end gap-1">' +
                '<span id="fil_cost_' + idx + '" class="text-[10px] font-bold text-indigo-500">R$ 0.00</span>' +
                (filamentCounter > 1 ?
                    '<button type="button" onclick="removeFilamentRow(' + idx + ')" ' +
                        'class="text-gray-400 hover:text-red-500 transition-colors" title="Remover">' +
                        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
                        '</svg>' +
                    '</button>' : '') +
            '</div>' +
        '</div>';

    container.appendChild(row);
    recalcFilaments();
}

function getDefaultFilamentPrice() {
    const el = document.getElementById('filament_price_kg');
    return el ? parseFloat(el.value) || 0 : 0;
}

function onSpoolChange(idx) {
    const select = document.getElementById('fil_spool_' + idx);
    const priceInput = document.getElementById('fil_price_' + idx);
    if (!select || !priceInput) return;

    const opt = select.options[select.selectedIndex];
    if (select.value !== 'custom' && opt.dataset.price) {
        priceInput.value = parseFloat(opt.dataset.price).toFixed(2);
        priceInput.readOnly = true;
        priceInput.classList.add('opacity-60');
    } else {
        priceInput.readOnly = false;
        priceInput.classList.remove('opacity-60');
    }
    recalcFilaments();
}

function removeFilamentRow(idx) {
    const row = document.getElementById('filament_row_' + idx);
    if (row) row.remove();
    recalcFilaments();
}

function recalcFilaments() {
    const container = document.getElementById('filaments_container');
    if (!container) return;

    const rows = container.querySelectorAll('.filament-row');
    let totalCost = 0;
    let totalWeight = 0;
    let weightedPriceSum = 0;

    rows.forEach(row => {
        const idx = row.id.replace('filament_row_', '');
        const price  = parseFloat(document.getElementById('fil_price_' + idx)?.value) || 0;
        const weight = parseFloat(document.getElementById('fil_weight_' + idx)?.value) || 0;

        const cost = (weight / 1000) * price;
        totalCost += cost;
        totalWeight += weight;
        weightedPriceSum += price * weight;

        const costEl = document.getElementById('fil_cost_' + idx);
        if (costEl) costEl.textContent = formatCurrency(cost);
    });

    const display = document.getElementById('filament_cost_display');
    if (display) display.textContent = formatCurrency(totalCost);

    setHidden('piece_weight_g', totalWeight.toFixed(2));

    const avgPrice = totalWeight > 0 ? (weightedPriceSum / totalWeight) : getDefaultFilamentPrice();
    setHidden('filament_price_kg', avgPrice.toFixed(2));

    const hint = document.getElementById('weight_hint');
    if (hint) {
        hint.textContent = totalWeight > 0
            ? 'Peso total: ' + totalWeight.toFixed(1) + 'g (' + (totalWeight / 1000).toFixed(3) + ' kg)'
            : 'Peso total da impressão';
    }

    calculate();
}

// ═══════════════════════════════════════════
//  SERIALIZAR FILAMENTOS → JSON
// ═══════════════════════════════════════════
function collectFilamentsJSON() {
    const container = document.getElementById('filaments_container');
    if (!container) return '[]';

    const rows = container.querySelectorAll('.filament-row');
    const arr = [];

    rows.forEach(row => {
        const idx = row.id.replace('filament_row_', '');
        const select = document.getElementById('fil_spool_' + idx);
        const price  = parseFloat(document.getElementById('fil_price_' + idx)?.value) || 0;
        const weight = parseFloat(document.getElementById('fil_weight_' + idx)?.value) || 0;

        if (weight <= 0) return;

        let name = 'Filamento manual';
        let color = '#cccccc';

        if (select && select.value !== 'custom') {
            const opt = select.options[select.selectedIndex];
            name = opt.dataset.name || opt.textContent.trim();
            color = opt.dataset.color || '#cccccc';
        }

        arr.push({
            name: name,
            color: color,
            price_kg: price,
            weight_g: weight,
        });
    });

    return JSON.stringify(arr);
}

// ═══════════════════════════════════════════
//  SERIALIZAR INSUMOS → JSON
// ═══════════════════════════════════════════
function collectSuppliesJSON() {
    const container = document.getElementById('supplies-container');
    if (!container) return '[]';

    const rows = container.querySelectorAll('.supply-row');
    const arr = [];

    rows.forEach(row => {
        const idx = row.id.replace('supply_row_', '');
        const nameInput = row.querySelector('input[type="text"]');
        const price = parseFloat(document.getElementById('sp_price_' + idx)?.value) || 0;
        const qty   = parseFloat(document.getElementById('sp_qty_' + idx)?.value) || 1;
        const use   = parseFloat(document.getElementById('sp_use_' + idx)?.value) || 1;

        const unitCost = qty > 0 ? (price / qty) * use : 0;

        arr.push({
            name: nameInput?.value || 'Insumo',
            price: price,
            qty_pack: qty,
            use: use,
            unit_cost: Math.round(unitCost * 100) / 100,
        });
    });

    return JSON.stringify(arr);
}

// ═══════════════════════════════════════════
//  RELOAD FROM URL (Recarregar orçamento)
// ═══════════════════════════════════════════
function initReloadFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Se não tem piece_weight_g, não é um reload de orçamento
    if (!params.has('piece_weight_g')) return;

    // ── Nome da peça ──
    const nameInput = document.getElementById('piece_name_input');
    if (nameInput && params.has('piece_name')) {
        nameInput.value = params.get('piece_name');
    }

    // ── Tempos (converter decimal → horas + minutos) ──
    if (params.has('print_time_h')) {
        const printH = parseFloat(params.get('print_time_h')) || 0;
        const ph = Math.floor(printH);
        const pm = Math.round((printH - ph) * 60);
        const printHoursEl = document.getElementById('print_hours');
        const printMinutesEl = document.getElementById('print_minutes');
        if (printHoursEl) printHoursEl.value = ph;
        if (printMinutesEl) printMinutesEl.value = pm;
    }

    if (params.has('manual_time_h')) {
        const manualH = parseFloat(params.get('manual_time_h')) || 0;
        const mh = Math.floor(manualH);
        const mm = Math.round((manualH - mh) * 60);
        const manualHoursEl = document.getElementById('manual_hours');
        const manualMinutesEl = document.getElementById('manual_minutes');
        if (manualHoursEl) manualHoursEl.value = mh;
        if (manualMinutesEl) manualMinutesEl.value = mm;
    }

    // ── Campos simples ──
    const simpleFields = {
        'depreciation_per_hour': 'depreciation_per_hour',
        'labor_per_hour': 'labor_per_hour',
        'risk_rate': 'risk_rate',
        'margin_percent': 'margin_percent',
        'lot_quantity': 'lot_quantity',
    };

    for (const [paramKey, elementId] of Object.entries(simpleFields)) {
        if (params.has(paramKey)) {
            const el = document.getElementById(elementId);
            if (el) {
                el.value = params.get(paramKey);
                const lsKey = 'pm_' + elementId;
                localStorage.setItem(lsKey, params.get(paramKey));
            }
        }
    }

    // ── Filamentos (recria as linhas a partir do JSON) ──
    if (params.has('filaments_json')) {
        try {
            const filaments = JSON.parse(params.get('filaments_json'));
            if (Array.isArray(filaments) && filaments.length > 0) {
                const container = document.getElementById('filaments_container');
                if (container) container.innerHTML = '';
                filamentCounter = 0;

                filaments.forEach(fil => {
                    addFilamentRow();
                    const idx = filamentCounter - 1;

                    const select = document.getElementById('fil_spool_' + idx);
                    const priceInput = document.getElementById('fil_price_' + idx);
                    const weightInput = document.getElementById('fil_weight_' + idx);

                    if (priceInput) priceInput.value = parseFloat(fil.price_kg || 0).toFixed(2);
                    if (weightInput) weightInput.value = parseFloat(fil.weight_g || 0);

                    if (select) {
                        let matched = false;
                        for (let i = 0; i < select.options.length; i++) {
                            const opt = select.options[i];
                            if (opt.value !== 'custom' &&
                                opt.dataset.name === fil.name &&
                                parseFloat(opt.dataset.price) === parseFloat(fil.price_kg)) {
                                select.selectedIndex = i;
                                if (priceInput) {
                                    priceInput.readOnly = true;
                                    priceInput.classList.add('opacity-60');
                                }
                                matched = true;
                                break;
                            }
                        }
                        if (!matched) {
                            select.value = 'custom';
                            if (priceInput) {
                                priceInput.readOnly = false;
                                priceInput.classList.remove('opacity-60');
                            }
                        }
                    }
                });

                recalcFilaments();
            }
        } catch (e) {
            console.warn('Erro ao parsear filaments_json da URL:', e);
        }
    }

    // ── Insumos (recria as linhas a partir do JSON) ──
    if (params.has('supplies_json')) {
        try {
            const supplies = JSON.parse(params.get('supplies_json'));
            if (Array.isArray(supplies) && supplies.length > 0) {
                supplies.forEach(sup => {
                    addSupplyRow();
                    const idx = supplyCounter - 1;

                    const row = document.getElementById('supply_row_' + idx);
                    const nameInput = row?.querySelector('input[type="text"]');
                    const priceInput = document.getElementById('sp_price_' + idx);
                    const qtyInput = document.getElementById('sp_qty_' + idx);
                    const useInput = document.getElementById('sp_use_' + idx);

                    if (nameInput) nameInput.value = sup.name || 'Insumo';
                    if (priceInput) priceInput.value = parseFloat(sup.price || 0).toFixed(2);
                    if (qtyInput) qtyInput.value = parseInt(sup.qty_pack || 1);
                    if (useInput) useInput.value = parseInt(sup.use || 1);
                });

                recalculateSupplies();
            }
        } catch (e) {
            console.warn('Erro ao parsear supplies_json da URL:', e);
        }
    }

    // ── Multiplicador de valor ──
    if (params.has('value_multiplier')) {
        const mult = parseFloat(params.get('value_multiplier')) || 1;
        if (mult > 1) {
            const toggle = document.getElementById('value-toggle');
            const panel = document.getElementById('value-multiplier-panel');
            const input = document.getElementById('value_multiplier_input');
            const hidden = document.getElementById('value_multiplier');

            if (toggle) {
                toggle.setAttribute('aria-pressed', 'true');
                toggle.classList.add('active');
                toggle.classList.remove('bg-gray-200', 'dark:bg-gray-700');
            }
            if (panel) panel.style.display = '';
            if (input) input.value = mult;
            if (hidden) hidden.value = mult;
        }
    }

    // ── Recalcula tudo ──
    calculate();

    // ── Limpa a URL para não recarregar ao dar F5 ──
    window.history.replaceState({}, '', window.location.pathname);

    // ── Toast de feedback ──
    setTimeout(() => {
        const name = params.get('piece_name') || 'Orçamento';
        showToast('📋 "' + name + '" carregado na calculadora!');
    }, 300);

    // ─── EDIÇÃO: marca orçamento sendo editado ───
    if (params.has('editing_budget_id')) {
        const budgetId = params.get('editing_budget_id');
        const form = document.getElementById('calc-form');
        if (form) {
            let hidden = form.querySelector('input[name="editing_budget_id"]');
            if (!hidden) {
                hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'editing_budget_id';
                form.appendChild(hidden);
            }
            hidden.value = budgetId;

            if (!document.getElementById('editing-banner')) {
                const banner = document.createElement('div');
                banner.id = 'editing-banner';
                banner.className = 'mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2';
                banner.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' +
                    '<span><strong>Editando orçamento #' + budgetId + '</strong> — ao salvar, o registro existente será atualizado.</span>';
                form.parentNode.insertBefore(banner, form);
            }
            console.log('[reload] modo EDIÇÃO ativo para budget ID', budgetId);
        } else {
            console.warn('[reload] form #calc-form não encontrado');
        }
    }
}

// ═══════════════════════════════════════════
//  LOCALSTORAGE PERSISTENCE
// ═══════════════════════════════════════════
function initLocalStoragePersistence() {
    const persistFields = [
        { id: 'depreciation_per_hour', key: 'pm_depreciation_per_hour' },
        { id: 'labor_per_hour',        key: 'pm_labor_per_hour' },
        { id: 'risk_rate',             key: 'pm_risk_rate' },
        { id: 'margin_percent',        key: 'pm_margin_percent' },
    ];
    persistFields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const saved = localStorage.getItem(key);
        if (saved !== null && saved !== '') {
            el.value = saved;
        }
        el.addEventListener('input', () => {
            localStorage.setItem(key, el.value);
        });
    });
    calculate();
}

// ═══════════════════════════════════════════
//  CALCULATOR CORE
// ═══════════════════════════════════════════
let _lastUnitCost = 0;

const ENERGY_TARIFF       = parseFloat(document.querySelector('[class*="bg-yellow-400"]')?.parentElement?.textContent?.match(/[\d.]+/)?.[0]) || 0.85;
const PRINTER_CONSUMPTION = parseFloat(document.querySelector('[class*="bg-blue-400"]')?.parentElement?.textContent?.match(/[\d.]+/)?.[0]) || 0.12;

function initCalculator() {
    const fields = [
        'print_hours', 'print_minutes',
        'manual_hours', 'manual_minutes',
        'depreciation_per_hour', 'labor_per_hour',
        'risk_rate', 'margin_percent', 'lot_quantity'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculate);
            if (id.includes('minutes')) {
                el.addEventListener('blur', function () {
                    let v = parseInt(this.value) || 0;
                    if (v > 59) { this.value = 59; calculate(); }
                    if (v < 0)  { this.value = 0;  calculate(); }
                });
            }
        }
    });
    calculate();
}

function getVal(id) {
    return parseFloat(document.getElementById(id)?.value) || 0;
}

function getTimeInHours(hoursId, minutesId) {
    return getVal(hoursId) + (getVal(minutesId) / 60);
}

function formatCurrency(v) {
    return 'R$ ' + v.toFixed(2);
}

function calculate() {
    const filamentPriceKg = getVal('filament_price_kg');
    const pieceWeightG    = getVal('piece_weight_g');
    const printTimeH      = getTimeInHours('print_hours', 'print_minutes');
    const manualTimeH     = getTimeInHours('manual_hours', 'manual_minutes');
    const depreciationH   = getVal('depreciation_per_hour');
    const laborH          = getVal('labor_per_hour');
    const riskRate        = getVal('risk_rate');
    const marginPercent   = getVal('margin_percent');
    const lotQty          = Math.max(1, Math.round(getVal('lot_quantity')));
    const suppliesCost    = getVal('supplies_cost');
    const valueMultiplier = parseFloat(document.getElementById('value_multiplier')?.value) || 1;

    const filamentCost     = (pieceWeightG / 1000) * filamentPriceKg;
    const energyCost       = printTimeH * PRINTER_CONSUMPTION * ENERGY_TARIFF;
    const depreciationCost = printTimeH * depreciationH;
    const laborCost        = manualTimeH * laborH;
    const subtotal         = filamentCost + energyCost + depreciationCost + laborCost + suppliesCost;
    const riskCost         = subtotal * (riskRate / 100);
    const totalCost        = subtotal + riskCost;

    const unitCost  = totalCost / lotQty;
    const unitPrice = unitCost * (1 + marginPercent / 100) * valueMultiplier;

    _lastUnitCost = unitCost;

    const finalPrice    = unitPrice;
    const lotTotalPrice = unitPrice * lotQty;

    setText('res_filament',            formatCurrency(filamentCost));
    setText('res_energy',              formatCurrency(energyCost));
    setText('res_depreciation',        formatCurrency(depreciationCost));
    setText('res_labor',               formatCurrency(laborCost));
    setText('res_supplies_breakdown',  formatCurrency(suppliesCost));
    setText('res_subtotal',            formatCurrency(subtotal));
    setText('res_risk',                formatCurrency(riskCost));
    setText('res_total',               formatCurrency(totalCost));

    const resTotalUnit = document.getElementById('res_total_unit');
    if (resTotalUnit) {
        if (lotQty > 1) {
            resTotalUnit.classList.remove('hidden');
            resTotalUnit.textContent = '(' + formatCurrency(unitCost) + ' / un)';
        } else {
            resTotalUnit.classList.add('hidden');
        }
    }

    const unitCostRow = document.getElementById('unit_cost_row');
    if (unitCostRow) {
        if (lotQty > 1) {
            unitCostRow.classList.remove('hidden');
            setText('res_unit_cost', formatCurrency(unitCost));
        } else {
            unitCostRow.classList.add('hidden');
        }
    }

    setText('res_final_price', formatCurrency(finalPrice));

    const lotSub = document.getElementById('lot_price_subtitle');
    if (lotSub) {
        if (lotQty > 1) {
            lotSub.classList.remove('hidden');
            setText('res_lot_total_price', formatCurrency(lotTotalPrice));
        } else {
            lotSub.classList.add('hidden');
        }
    }

    const batchLabel = document.getElementById('batch_label');
    if (batchLabel) {
        batchLabel.textContent = lotQty > 1 ? '— Preço por Peça (lote de ' + lotQty + ')' : '';
    }

    const lotHint = document.getElementById('lot_hint');
    if (lotHint) {
        lotHint.textContent = lotQty > 1
            ? lotQty + ' peças nesse lote'
            : 'Quantas peças saem dessa impressão';
    }

    const riskLabel = document.getElementById('risk_label');
    if (riskLabel) riskLabel.textContent = '(' + riskRate + '%)';

    const marginLabel = document.getElementById('margin_label');
    if (marginLabel) marginLabel.textContent = marginPercent + '%';

    const multLabel = document.getElementById('mult_label');
    if (multLabel) {
        multLabel.textContent = valueMultiplier > 1 ? ' • ×' + valueMultiplier.toFixed(1) : '';
    }

    setTimeLabel('print_time_label', printTimeH);
    setTimeLabel('manual_time_label', manualTimeH);

    const costRef = unitCost;
    setText('res_price100', formatCurrency(costRef * 2));
    setText('res_price200', formatCurrency(costRef * 3));
    setText('res_price400', formatCurrency(costRef * 5));

    setHidden('h_filament_price_kg',     filamentPriceKg);
    setHidden('h_piece_weight_g',        pieceWeightG);
    setHidden('h_print_time_h',          printTimeH.toFixed(4));
    setHidden('h_manual_time_h',         manualTimeH.toFixed(4));
    setHidden('h_depreciation_per_hour', depreciationH);
    setHidden('h_labor_per_hour',        laborH);
    setHidden('h_risk_rate',             riskRate);
    setHidden('h_margin_percent',        marginPercent);
    setHidden('h_supplies_cost',         suppliesCost.toFixed(4));
    setHidden('h_value_multiplier',      valueMultiplier);
    setHidden('h_unit_cost',             unitCost.toFixed(2));
    setHidden('h_unit_price',            unitPrice.toFixed(2));
    setHidden('lot_quantity_hidden',     lotQty);
    setHidden('calc_total_cost',         totalCost.toFixed(2));

    updateVolumeTable(finalPrice);
    updateSimulator();
}

// ═══════════════════════════════════════════
//  VOLUME DISCOUNT TABLE
// ═══════════════════════════════════════════
function updateVolumeTable(unitPrice) {
    const tier1 = unitPrice;
    const tier2 = unitPrice * 0.85;
    const tier3 = unitPrice * 0.70;

    setText('vol_tier1_price', formatCurrency(tier1));
    setText('vol_tier2_price', formatCurrency(tier2));
    setText('vol_tier3_price', formatCurrency(tier3));
}

// ═══════════════════════════════════════════
//  INSUMOS DE MONTAGEM
// ═══════════════════════════════════════════
let supplyCounter = 0;

function initSupplies() {
    const addBtn = document.getElementById('add-supply-btn');
    if (addBtn) {
        addBtn.addEventListener('click', addSupplyRow);
    }
}

function addSupplyRow() {
    const container = document.getElementById('supplies-container');
    const placeholder = document.getElementById('supplies-placeholder');
    if (!container) return;

    if (placeholder) placeholder.style.display = 'none';

    const idx = supplyCounter++;
    const row = document.createElement('div');
    row.id = 'supply_row_' + idx;
    row.className = 'supply-row grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 mb-2';
    row.innerHTML =
        '<div class="col-span-4">' +
            '<label class="block text-[10px] font-bold text-gray-400 mb-1">Insumo</label>' +
            '<input type="text" placeholder="Ex: Parafuso M3" ' +
                   'class="supply-name w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                   'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                   'focus:ring-1 focus:ring-blue-500 focus:outline-none">' +
        '</div>' +
        '<div class="col-span-2">' +
            '<label class="block text-[10px] font-bold text-gray-400 mb-1">Preço (R$)</label>' +
            '<input type="number" step="0.01" min="0" value="0" id="sp_price_' + idx + '" ' +
                   'oninput="recalculateSupplies()" ' +
                   'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                   'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                   'focus:ring-1 focus:ring-blue-500 focus:outline-none text-center">' +
        '</div>' +
        '<div class="col-span-2">' +
            '<label class="block text-[10px] font-bold text-gray-400 mb-1">Qtd Pacote</label>' +
            '<input type="number" step="1" min="1" value="1" id="sp_qty_' + idx + '" ' +
                   'oninput="recalculateSupplies()" ' +
                   'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                   'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                   'focus:ring-1 focus:ring-blue-500 focus:outline-none text-center">' +
        '</div>' +
        '<div class="col-span-2">' +
            '<label class="block text-[10px] font-bold text-gray-400 mb-1">Usar</label>' +
            '<input type="number" step="1" min="1" value="1" id="sp_use_' + idx + '" ' +
                   'oninput="recalculateSupplies()" ' +
                   'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                   'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                   'focus:ring-1 focus:ring-blue-500 focus:outline-none text-center">' +
        '</div>' +
        '<div class="col-span-2 flex items-end justify-end gap-1">' +
            '<span id="sp_cost_' + idx + '" class="text-xs font-bold text-emerald-500">R$ 0.00</span>' +
            '<button type="button" onclick="removeSupplyRow(' + idx + ')" ' +
                    'class="text-gray-400 hover:text-red-500 transition-colors ml-1" title="Remover">' +
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
                '</svg>' +
            '</button>' +
        '</div>';

    container.appendChild(row);
    updateSupplyCount();

    const totalBar = document.getElementById('supplies-total-bar');
    if (totalBar) totalBar.classList.remove('hidden');
}

function removeSupplyRow(idx) {
    const row = document.getElementById('supply_row_' + idx);
    if (row) row.remove();
    recalculateSupplies();
    updateSupplyCount();

    const container = document.getElementById('supplies-container');
    const rows = container?.querySelectorAll('.supply-row');
    if (!rows || rows.length === 0) {
        const placeholder = document.getElementById('supplies-placeholder');
        if (placeholder) placeholder.style.display = 'block';
        const totalBar = document.getElementById('supplies-total-bar');
        if (totalBar) totalBar.classList.add('hidden');
    }
}

function updateSupplyCount() {
    const container = document.getElementById('supplies-container');
    const badge = document.getElementById('supply-count');
    if (!container || !badge) return;
    const count = container.querySelectorAll('.supply-row').length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function recalculateSupplies() {
    const container = document.getElementById('supplies-container');
    if (!container) return;
    const rows = container.querySelectorAll('.supply-row');
    let total = 0;

    rows.forEach(row => {
        const idx = row.id.replace('supply_row_', '');
        const price = parseFloat(document.getElementById('sp_price_' + idx)?.value) || 0;
        const qty   = parseFloat(document.getElementById('sp_qty_' + idx)?.value) || 1;
        const use   = parseFloat(document.getElementById('sp_use_' + idx)?.value) || 1;

        const unitCost = qty > 0 ? price / qty : 0;
        const rowCost  = unitCost * use;
        total += rowCost;

        const costEl = document.getElementById('sp_cost_' + idx);
        if (costEl) costEl.textContent = formatCurrency(rowCost);
    });

    setHidden('supplies_cost', total.toFixed(4));
    setText('supplies-total-value', formatCurrency(total));
    calculate();
}

// ═══════════════════════════════════════════
//  VALOR MULTIPLICADOR (toggle switch)
// ═══════════════════════════════════════════
function initValueMultiplier() {
    const toggle = document.getElementById('value-toggle');
    const panel  = document.getElementById('value-multiplier-panel');
    const input  = document.getElementById('value_multiplier_input');
    const hidden = document.getElementById('value_multiplier');

    if (!toggle || !panel) return;

    if (!toggle.querySelector('.toggle-dot')) {
        toggle.innerHTML = '<span class="toggle-dot"></span>';
    }

    toggle.setAttribute('aria-pressed', 'false');
    toggle.classList.add('bg-gray-200', 'dark:bg-gray-700');

    toggle.addEventListener('click', () => {
        const isActive = toggle.getAttribute('aria-pressed') === 'true';
        const newState = !isActive;
        toggle.setAttribute('aria-pressed', String(newState));

        if (newState) {
            toggle.classList.add('active');
            toggle.classList.remove('bg-gray-200', 'dark:bg-gray-700');
            panel.style.display = '';
        } else {
            toggle.classList.remove('active');
            toggle.classList.add('bg-gray-200', 'dark:bg-gray-700');
            panel.style.display = 'none';
            if (input) input.value = '1';
            if (hidden) hidden.value = '1';
            calculate();
        }
    });

    if (input) {
        input.addEventListener('input', () => {
            const v = parseFloat(input.value) || 1;
            if (hidden) hidden.value = v;
            calculate();
        });
    }
}

// ═══════════════════════════════════════════
//  SIMULADOR DE REVENDA / ATACADO
// ═══════════════════════════════════════════
function initSimulator() {
    const retail    = document.getElementById('sim_retail_price');
    const wholesale = document.getElementById('sim_wholesale_price');
    if (retail)    retail.addEventListener('input', updateSimulator);
    if (wholesale) wholesale.addEventListener('input', updateSimulator);
}

function updateSimulator() {
    const retailPrice    = getVal('sim_retail_price');
    const wholesalePrice = getVal('sim_wholesale_price');

    if (retailPrice <= 0 || wholesalePrice <= 0) {
        setText('sim_your_profit', formatCurrency(0));
        setText('sim_reseller_profit', formatCurrency(0));
        setBarWidth('sim_your_bar', 0, '');
        setBarWidth('sim_reseller_bar', 0, '');
        const alert = document.getElementById('sim_alert');
        if (alert) alert.style.display = 'none';
        return;
    }

    const yourProfit     = wholesalePrice - _lastUnitCost;
    const resellerProfit = retailPrice - wholesalePrice;

    setText('sim_your_profit', formatCurrency(yourProfit));
    setText('sim_reseller_profit', formatCurrency(resellerProfit));

    const yourPct     = retailPrice > 0 ? Math.max(0, Math.min(100, (yourProfit / retailPrice) * 100)) : 0;
    const resellerPct = retailPrice > 0 ? Math.max(0, Math.min(100, (resellerProfit / retailPrice) * 100)) : 0;

    setBarWidth('sim_your_bar', yourPct, yourProfit > 0 ? formatCurrency(yourProfit) : 'R$ 0.00');
    setBarWidth('sim_reseller_bar', resellerPct, resellerProfit > 0 ? formatCurrency(resellerProfit) : 'R$ 0.00');

    const yourEl = document.getElementById('sim_your_profit');
    if (yourEl) {
        yourEl.classList.remove('text-emerald-500', 'text-red-500');
        yourEl.classList.add(yourProfit < 0 ? 'text-red-500' : 'text-emerald-500');
    }

    const alert = document.getElementById('sim_alert');
    if (alert) {
        alert.style.display = (wholesalePrice < _lastUnitCost && _lastUnitCost > 0) ? 'flex' : 'none';
    }
}

function setBarWidth(id, pct, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = Math.max(0, pct) + '%';
    el.textContent = label || '';
}

// ═══════════════════════════════════════════
//  FORM SUBMIT — SERIALIZA TUDO
// ═══════════════════════════════════════════
function initFormSubmit() {
    const calcForm = document.getElementById('calc-form');
    if (calcForm) {
                // === SYNC NOME/PESO ANTES DO SUBMIT (Bug 1 fix) ===
        calcForm.addEventListener('submit', (e) => {
            const nameInput  = document.getElementById('piece_name_input');
            const nameHidden = document.getElementById('h_piece_name');
            if (nameInput && nameHidden) {
                const v = (nameInput.value || '').trim();
                nameHidden.value = v || 'Sem nome';
            }
            const weightInput  = document.getElementById('piece_weight_g');
            const weightHidden = document.getElementById('h_piece_weight_g');
            if (weightInput && weightHidden) {
                weightHidden.value = weightInput.value || '0';
            }
            // === SYNC JSON FILAMENTOS/INSUMOS (fix backend recebendo '[]') ===
            try {
                const fHidden = document.getElementById('h_filaments_json');
                const sHidden = document.getElementById('h_supplies_json');
                if (fHidden && typeof collectFilamentsJSON === 'function') {
                    fHidden.value = collectFilamentsJSON();
                }
                if (sHidden && typeof collectSuppliesJSON === 'function') {
                    sHidden.value = collectSuppliesJSON();
                }
                console.log('[submit] filaments_json =', fHidden && fHidden.value);
                console.log('[submit] supplies_json  =', sHidden && sHidden.value);
            } catch (err) {
                console.warn('[submit] erro ao serializar JSON:', err);
            }
            // === FIM SYNC JSON ===
        }, true); // capture: roda ANTES do handler async abaixo
        // === FIM SYNC ===
        calcForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // === BUG 1 FIX: sync nome do input visível para o hidden ===
            const nameInput  = document.getElementById('piece_name_input');
            const nameHidden = document.getElementById('h_piece_name');
            if (nameInput && nameHidden) {
                const v = (nameInput.value || '').trim();
                nameHidden.value = v || 'Sem nome';
            }
            // === FIM BUG 1 FIX ===
            const submitBtn = calcForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try {
                const res = await fetch('/calculator', { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') }, body: new FormData(calcForm) });
                if (res.ok || res.redirected) {
                    window.location.href = '/?saved=1';
                    return;
                } else {
                    showToast('Erro ao salvar (' + res.status + ')');
                }
            } catch (err) {
                console.error('Erro:', err);
                showToast('Erro de rede');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
            }
        });
    }
}


// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
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
    else if (h === 0) el.textContent = '= ' + m + 'min';
    else if (m === 0) el.textContent = '= ' + h + 'h';
    else el.textContent = '= ' + h + 'h ' + m + 'min';
}

// ═══════════════════════════════════════════
//  TOASTS
// ═══════════════════════════════════════════
function initToasts() {
    const params = new URLSearchParams(window.location.search);
    let msg = null;
    if (params.has('saved'))          msg = '✅ Orçamento salvo com sucesso!';
        if (params.has('updated'))        msg = '✏️ Orçamento atualizado com sucesso!';
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

// ═══════════════════════════════════════════
//  BUTTON FEEDBACK
// ═══════════════════════════════════════════
function initButtonFeedback() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.95)');
        btn.addEventListener('mouseup',   () => btn.style.transform = '');
        btn.addEventListener('mouseleave', () => btn.style.transform = '');
    });
}

// ═══════════════════════════════════════════
//  CONFIRMS (usado no history/queue)
// ═══════════════════════════════════════════
function confirmDelete(msg) {
    return confirm(msg || 'Tem certeza que deseja remover este item?');
}
function confirmClear() {
    return confirm('⚠️ Isso removerá TODOS os orçamentos do histórico. Continuar?');
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD DATA — carrega via /api/dashboard
// ═══════════════════════════════════════════════════════════════
async function loadDashboardData() {
    try {
        const res = await fetch('/api/dashboard', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') } });
        if (!res.ok) { console.warn('[dashboard] status:', res.status); return; }
        const data = await res.json();
        console.log('[dashboard] dados carregados:', data);
        applyDashboardData(data);
    } catch (err) {
        console.warn('[dashboard] falha ao carregar:', err);
    }
}

function applyDashboardData(data) {
    const { roi } = data;
    if (!roi) return;

    const machineCost       = roi.machine_cost ?? 0;
    const depreciationTotal = roi.depreciation_total ?? 0;
    const roiPercent        = roi.roi_percent ?? 0;
    const roiPct            = Math.min(roiPercent, 100);

    // Input do formulário
    const inputMC = document.getElementById('input_machine_cost');
    if (inputMC) inputMC.value = machineCost;

    // Depreciação acumulada
    const elDep = document.getElementById('roi_depreciation_total');
    if (elDep) elDep.textContent = 'R$ ' + depreciationTotal.toFixed(2);

    // Barra de progresso
    const bar = document.getElementById('roi_bar');
    if (bar) {
        bar.style.width = roiPct + '%';
        bar.classList.toggle('bg-emerald-500', roiPercent >= 100);
        bar.classList.toggle('bg-indigo-500',  roiPercent < 100);
    }

    // Textos de %  e meta
    const elPct  = document.getElementById('roi_percent_text');
    if (elPct)  elPct.textContent  = roiPercent.toFixed(1) + '% amortizado';

    const elMeta = document.getElementById('roi_machine_cost_text');
    if (elMeta) elMeta.textContent = 'Meta: R$ ' + machineCost.toFixed(2);

    console.log('[ROI] atualizado → cost:', machineCost, '| deprec:', depreciationTotal, '| %:', roiPercent);
}

// ── machine_cost form ──────────────────────────────────────────
(function () {
    const machineForm = document.querySelector('form[action="/settings/machine"]');
    if (!machineForm) return;
    machineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/settings/machine', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') },
                body: new FormData(machineForm),
            });
            if (res.ok || res.redirected) {
                showToast('⚙️ Custo da máquina atualizado!');
                await loadDashboardData();
            } else {
                showToast('❌ Erro ao atualizar (' + res.status + ')');
            }
        } catch (err) {
            console.error('[machineForm]', err);
            showToast('❌ Erro de rede');
        }
    });
})();
