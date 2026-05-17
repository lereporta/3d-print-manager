// ===== 3D Print Manager - Frontend Logic v5 (dashboard.html) =====
// Compatível com a estrutura do dashboard.html

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initSpoolsData();
    addFilamentRow();          // primeira linha automática
    initCalculator();
    initSupplies();
    initValueMultiplier();
    initSimulator();
    initLocalStoragePersistence();
    initFormSubmit();
    initToasts();
    initButtonFeedback();

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

function initSpoolsData() {
    try {
        const el = document.getElementById('spools_data');
        if (el) SPOOLS = JSON.parse(el.textContent) || [];
    } catch (e) {
        console.warn('Erro ao ler spools_data:', e);
        SPOOLS = [];
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

    // Build spool <option>s
    let spoolOptions = '<option value="custom">✏️ Digitar manualmente</option>';
    SPOOLS.forEach(s => {
        const label = s.material + ' ' + s.color + ' — R$ ' + parseFloat(s.price_per_kg).toFixed(2) + '/kg';
        spoolOptions += '<option value="' + s.id + '" data-price="' + s.price_per_kg + '">' + label + '</option>';
    });

    row.innerHTML =
        '<div class="grid grid-cols-12 gap-2 items-end">' +
            // Spool select
            '<div class="col-span-12 sm:col-span-5">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Filamento</label>' +
                '<select id="fil_spool_' + idx + '" onchange="onSpoolChange(' + idx + ')" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none">' +
                    spoolOptions +
                '</select>' +
            '</div>' +
            // Price per kg
            '<div class="col-span-5 sm:col-span-3">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Preço/KG (R$)</label>' +
                '<input type="number" step="0.01" min="0" value="' + getDefaultFilamentPrice() + '" ' +
                    'id="fil_price_' + idx + '" oninput="recalcFilaments()" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none text-center">' +
            '</div>' +
            // Weight (g)
            '<div class="col-span-5 sm:col-span-3">' +
                '<label class="block text-[10px] font-bold text-gray-400 mb-1">Peso (g)</label>' +
                '<input type="number" step="0.1" min="0" value="0" ' +
                    'id="fil_weight_' + idx + '" oninput="recalcFilaments()" ' +
                    'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
                    'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 ' +
                    'focus:ring-1 focus:ring-indigo-500 focus:outline-none text-center">' +
            '</div>' +
            // Remove + row cost
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
    // Lê do hidden que veio do settings do Jinja
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
    // Para o hidden h_filament_price_kg, usamos a média ponderada
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

    // Atualiza display
    const display = document.getElementById('filament_cost_display');
    if (display) display.textContent = formatCurrency(totalCost);

    // Atualiza hiddens auxiliares que o calculate() lê
    setHidden('piece_weight_g', totalWeight.toFixed(2));

    // Preço médio ponderado por kg (para o hidden do POST)
    const avgPrice = totalWeight > 0 ? (weightedPriceSum / totalWeight) : getDefaultFilamentPrice();
    setHidden('filament_price_kg', avgPrice.toFixed(2));

    // Hint de peso
    const hint = document.getElementById('weight_hint');
    if (hint) {
        hint.textContent = totalWeight > 0
            ? 'Peso total: ' + totalWeight.toFixed(1) + 'g (' + (totalWeight / 1000).toFixed(3) + ' kg)'
            : 'Peso total da impressão';
    }

    calculate();
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

// Lê constantes de energia do HTML (embutidas pelo Jinja nos badges da seção Parâmetros)
// Fallback para valores padrão caso não consiga extrair
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
    // === Inputs ===
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

    // === Cost breakdown (TOTAL for the entire print job / lot) ===
    const filamentCost     = (pieceWeightG / 1000) * filamentPriceKg;
    const energyCost       = printTimeH * PRINTER_CONSUMPTION * ENERGY_TARIFF;
    const depreciationCost = printTimeH * depreciationH;
    const laborCost        = manualTimeH * laborH;
    const subtotal         = filamentCost + energyCost + depreciationCost + laborCost + suppliesCost;
    const riskCost         = subtotal * (riskRate / 100);
    const totalCost        = subtotal + riskCost;

    // === Per-unit costs ===
    const unitCost  = totalCost / lotQty;
    const unitPrice = unitCost * (1 + marginPercent / 100) * valueMultiplier;

    _lastUnitCost = unitCost;

    const finalPrice    = unitPrice;
    const lotTotalPrice = unitPrice * lotQty;

    // === Update Breakdown (IDs do dashboard.html: res_*) ===
    setText('res_filament',            formatCurrency(filamentCost));
    setText('res_energy',              formatCurrency(energyCost));
    setText('res_depreciation',        formatCurrency(depreciationCost));
    setText('res_labor',               formatCurrency(laborCost));
    setText('res_supplies_breakdown',  formatCurrency(suppliesCost));
    setText('res_subtotal',            formatCurrency(subtotal));
    setText('res_risk',                formatCurrency(riskCost));
    setText('res_total',               formatCurrency(totalCost));

    // Unit cost hint next to total
    const resTotalUnit = document.getElementById('res_total_unit');
    if (resTotalUnit) {
        if (lotQty > 1) {
            resTotalUnit.classList.remove('hidden');
            resTotalUnit.textContent = '(' + formatCurrency(unitCost) + ' / un)';
        } else {
            resTotalUnit.classList.add('hidden');
        }
    }

    // Unit cost row
    const unitCostRow = document.getElementById('unit_cost_row');
    if (unitCostRow) {
        if (lotQty > 1) {
            unitCostRow.classList.remove('hidden');
            setText('res_unit_cost', formatCurrency(unitCost));
        } else {
            unitCostRow.classList.add('hidden');
        }
    }

    // === Final Price Card ===
    setText('res_final_price', formatCurrency(finalPrice));

    // Lot subtitle
    const lotSub = document.getElementById('lot_price_subtitle');
    if (lotSub) {
        if (lotQty > 1) {
            lotSub.classList.remove('hidden');
            setText('res_lot_total_price', formatCurrency(lotTotalPrice));
        } else {
            lotSub.classList.add('hidden');
        }
    }

    // Batch label
    const batchLabel = document.getElementById('batch_label');
    if (batchLabel) {
        batchLabel.textContent = lotQty > 1 ? '— Preço por Peça (lote de ' + lotQty + ')' : '';
    }

    // Lot hint
    const lotHint = document.getElementById('lot_hint');
    if (lotHint) {
        lotHint.textContent = lotQty > 1
            ? lotQty + ' peças nesse lote'
            : 'Quantas peças saem dessa impressão';
    }

    // === Labels ===
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

    // === Reference prices ===
    const costRef = unitCost; // base = custo unitário
    setText('res_price100', formatCurrency(costRef * 2));       // 100% margin
    setText('res_price200', formatCurrency(costRef * 3));       // 200% margin
    setText('res_price400', formatCurrency(costRef * 5));       // 400% margin

    // === Hidden fields for form submission ===
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

    // === Volume discount table ===
    updateVolumeTable(finalPrice);

    // === Simulator ===
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
                   'class="w-full rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-900 ' +
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

    // Atualiza o hidden auxiliar "supplies_cost" (linha 75 do HTML)
    setHidden('supplies_cost', total.toFixed(4));

    // Total display
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

    // Cria o dot (bolinha) dentro do toggle se não existir
    if (!toggle.querySelector('.toggle-dot')) {
        toggle.innerHTML = '<span class="toggle-dot"></span>';
    }

    // Estado inicial
    toggle.setAttribute('aria-pressed', 'false');
    toggle.classList.add('bg-gray-200', 'dark:bg-gray-700');

    toggle.addEventListener('click', () => {
        const isActive = toggle.getAttribute('aria-pressed') === 'true';
        const newState = !isActive;
        toggle.setAttribute('aria-pressed', String(newState));

        const dot = toggle.querySelector('.toggle-dot');

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

    // Bars
    const yourPct     = retailPrice > 0 ? Math.max(0, Math.min(100, (yourProfit / retailPrice) * 100)) : 0;
    const resellerPct = retailPrice > 0 ? Math.max(0, Math.min(100, (resellerProfit / retailPrice) * 100)) : 0;

    setBarWidth('sim_your_bar', yourPct, yourProfit > 0 ? formatCurrency(yourProfit) : 'R$ 0.00');
    setBarWidth('sim_reseller_bar', resellerPct, resellerProfit > 0 ? formatCurrency(resellerProfit) : 'R$ 0.00');

    // Color
    const yourEl = document.getElementById('sim_your_profit');
    if (yourEl) {
        yourEl.classList.remove('text-emerald-500', 'text-red-500');
        yourEl.classList.add(yourProfit < 0 ? 'text-red-500' : 'text-emerald-500');
    }

    // Alert
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
//  FORM SUBMIT — preencher hidden + nome
// ═══════════════════════════════════════════
function initFormSubmit() {
    const form = document.getElementById('calc-form');
    if (!form) return;
    form.addEventListener('submit', () => {
        const nameInput = document.getElementById('piece_name_input');
        const nameHidden = document.getElementById('h_piece_name');
        if (nameInput && nameHidden) {
            nameHidden.value = nameInput.value || 'Sem nome';
        }
        // Garante que todos os hiddens estejam atualizados
        calculate();
    });
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

