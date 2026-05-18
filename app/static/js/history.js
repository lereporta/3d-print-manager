// ===== History Page — SPA-like: busca dados via API e renderiza =====

const fc = v => 'R$ ' + (Number(v) || 0).toFixed(2);
const formatTime = h => {
    const hrs = Math.floor(h || 0);
    const mins = Math.round(((h || 0) - hrs) * 60);
    if (hrs === 0 && mins === 0) return '0min';
    if (hrs === 0) return mins + 'min';
    if (mins === 0) return hrs + 'h';
    return hrs + 'h ' + mins + 'min';
};

// ── Auth helper ──
function authHeaders() {
    const token = localStorage.getItem('jwt_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}
async function authFetch(url, opts = {}) {
    opts.headers = { ...(opts.headers || {}), ...authHeaders() };
    return fetch(url, opts);
}

// ── Estado global ──
let allBudgets = [];
let currentModalBudgetId = null;  // ID do orçamento aberto no modal

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
    await loadBudgets();
    bindForms();
    bindSearch();
    bindModalReloadButtons();
});

// ── Vincula os botões do modal UMA ÚNICA VEZ (não dependem de dataset) ──
function bindModalReloadButtons() {
    const btnSmall = document.getElementById('modal-reload-btn');
    const btnLarge = document.getElementById('modal-reload-btn-large');
    if (btnSmall) {
        btnSmall.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentModalBudgetId) reloadBudget(currentModalBudgetId, btnSmall);
        });
    }
    if (btnLarge) {
        btnLarge.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentModalBudgetId) reloadBudget(currentModalBudgetId, btnLarge);
        });
    }
}

async function loadBudgets() {
    const tableWrap = document.getElementById('history-table-wrap');
    const emptyState = document.getElementById('history-empty');
    const actionsBar = document.getElementById('history-actions');
    const loading = document.getElementById('history-loading');
    loading?.classList.add('hidden');

    try {
        const res = await authFetch('/history/api/list');
        if (!res.ok) {
            if (res.status === 401) { console.warn('[history] não autenticado'); return; }
            throw new Error('HTTP ' + res.status);
        }
        allBudgets = await res.json();
    } catch (err) {
        console.error('[history] erro ao carregar:', err);
        allBudgets = [];
    }

    renderStats(allBudgets);

    if (!allBudgets.length) {
        tableWrap?.classList.add('hidden');
        actionsBar?.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        return;
    }

    emptyState?.classList.add('hidden');
    tableWrap?.classList.remove('hidden');
    actionsBar?.classList.remove('hidden');
    renderTable(allBudgets);
}

function renderStats(budgets) {
    const n = budgets.length;
    const avgCost = n ? budgets.reduce((s, b) => s + (b.total_cost || 0), 0) / n : 0;
    const maxPrice = n ? Math.max(...budgets.map(b => b.final_price || 0)) : 0;
    const revenue = budgets.reduce((s, b) => s + (b.final_price || 0) * (b.lot_quantity || 1), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-count', n);
    set('stat-avg', fc(avgCost));
    set('stat-max', fc(maxPrice));
    set('stat-revenue', fc(revenue));
    set('stat-badge', n);
}

function renderTable(budgets) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    tbody.innerHTML = budgets.map(b => {
        const dt = b.created_at ? new Date(b.created_at) : null;
        const dateStr = dt ? dt.toLocaleDateString('pt-BR') : '';
        const timeStr = dt ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const isLot = b.lot_quantity && b.lot_quantity > 1;
        const unitCost = b.unit_cost || (isLot ? b.total_cost / b.lot_quantity : b.total_cost);

        return `
        <tr class="table-row border-b border-gray-100 dark:border-gray-800 history-row cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors"
            data-name="${(b.piece_name || '').toLowerCase()}"
            onclick="openDetailModal(${b.id})">
            <td class="py-3 px-3">
                <div class="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">${b.piece_name || 'Sem nome'}</div>
                <div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                    <span>${(b.piece_weight_g || 0).toFixed(1)}g</span>
                    <span class="text-gray-300 dark:text-gray-600">•</span>
                    <span>${formatTime(b.print_time_h)}</span>
                    ${b.supplies_cost > 0 ? '<span class="text-gray-300 dark:text-gray-600">•</span><span class="text-amber-500">+insumos</span>' : ''}
                </div>
            </td>
            <td class="py-3 px-3 text-right">
                <span class="font-bold text-indigo-500">${fc(b.total_cost)}</span>
                ${isLot ? `<div class="text-[10px] text-gray-400">${fc(unitCost)} / un</div>` : ''}
            </td>
            <td class="py-3 px-3 text-center">
                <span class="inline-flex items-center gap-1">
                    <span class="badge badge-printing">${(b.margin_percent || 0).toFixed(0)}%</span>
                    ${b.value_multiplier > 1 ? `<span class="badge badge-urgent text-[9px]">×${b.value_multiplier.toFixed(1)}</span>` : ''}
                </span>
            </td>
            <td class="py-3 px-3 text-right">
                <span class="font-extrabold text-emerald-500 text-base">${fc(b.final_price)}</span>
                ${isLot ? `<div class="text-[10px] text-gray-400">lote: ${fc(b.final_price * b.lot_quantity)}</div>` : ''}
            </td>
            <td class="py-3 px-3 text-center hidden sm:table-cell">
                ${isLot
                    ? `<span class="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 text-xs font-bold px-2 py-0.5 rounded-full">${b.lot_quantity}×</span>`
                    : `<span class="text-gray-400 text-xs">1×</span>`}
            </td>
            <td class="py-3 px-3 hidden md:table-cell">
                <span class="font-mono text-xs text-gray-500">${dateStr}</span><br>
                <span class="text-[10px] text-gray-400">${timeStr}</span>
            </td>
            <td class="py-3 px-3 text-center" onclick="event.stopPropagation();">
                <div class="flex items-center justify-center gap-1">
                    <button type="button" onclick="openDetailModal(${b.id})" title="Ver detalhes"
                            class="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-400 hover:text-indigo-600 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                    <button type="button" onclick="reloadBudget(${b.id}, this)" title="Recarregar na calculadora"
                            class="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-50">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                    <button type="button" onclick="deleteBudget(${b.id})" title="Remover"
                            class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────
//  RELOAD: salva os dados no sessionStorage e redireciona
//  para "/" SEM query string (evita URL gigante e 401)
// ─────────────────────────────────────────────────────
async function reloadBudget(id, btnEl) {
    if (!id) { console.error('[reload] id inválido:', id); return; }
    const originalHTML = btnEl ? btnEl.innerHTML : null;
    if (btnEl) {
        btnEl.innerHTML = '<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>';
        btnEl.disabled = true;
    }
    try {
        // ✅ Usa endpoint /api/reload/ que JÁ devolve a URL com query string
        //    montada pelo backend via _budget_to_query() — garante todos os campos
        const res = await authFetch('/history/api/reload/' + id);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const d = await res.json();
        if (!d.redirect_url) throw new Error('redirect_url ausente na resposta');

        // Acrescenta editing_budget_id se não vier na URL do backend
        const url = new URL(d.redirect_url, window.location.origin);
        if (!url.searchParams.has('editing_budget_id')) {
            url.searchParams.set('editing_budget_id', id);
        }
        window.location.href = url.pathname + '?' + url.searchParams.toString();
    } catch (err) {
        console.error('[reload] erro:', err);
        alert('Erro ao recarregar orçamento. Tente novamente.');
        if (btnEl && originalHTML !== null) {
            btnEl.innerHTML = originalHTML;
            btnEl.disabled = false;
        }
    }
}

async function deleteBudget(id) {
    if (!confirm('Remover este orçamento?')) return;
    try {
        const res = await authFetch('/history/delete/' + id, { method: 'POST', redirect: 'manual' });
        if (res.ok || res.status === 0 || res.type === 'opaqueredirect' || res.redirected) {
            await loadBudgets();
        } else { alert('Erro (' + res.status + ')'); }
    } catch (err) { console.error(err); alert('Erro de rede'); }
}

async function clearAll() {
    if (!confirm('Tem certeza que deseja limpar TODO o histórico?')) return;
    try {
        const res = await authFetch('/history/clear', { method: 'POST', redirect: 'manual' });
        if (res.ok || res.status === 0 || res.type === 'opaqueredirect' || res.redirected) {
            await loadBudgets();
        } else { alert('Erro (' + res.status + ')'); }
    } catch (err) { console.error(err); alert('Erro de rede'); }
}

function bindForms() {
    const clearBtn = document.getElementById('btn-clear-history');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
}

function bindSearch() {
    const searchInput = document.getElementById('history-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', function() {
        const q = this.value.toLowerCase().trim();
        document.querySelectorAll('.history-row').forEach(row => {
            const name = row.getAttribute('data-name') || '';
            row.style.display = (!q || name.includes(q)) ? '' : 'none';
        });
    });
}

// ─────────────────────────────────────────────────────
//  MODAL DE DETALHES
// ─────────────────────────────────────────────────────
function openDetailModal(budgetId) {
    const modal = document.getElementById('detail-modal');
    const panel = document.getElementById('detail-panel');
    const loader = document.getElementById('modal-loader');
    const content = document.getElementById('modal-content');

    // ⭐ Guarda o ID no estado global, NÃO no dataset
    currentModalBudgetId = budgetId;
    console.log('[modal] abrindo orçamento ID:', budgetId);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    loader.classList.remove('hidden');
    content.classList.add('hidden');

    requestAnimationFrame(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    });

    authFetch('/history/api/' + budgetId)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
            renderModalContent(data);
            loader.classList.add('hidden');
            content.classList.remove('hidden');
        })
        .catch(err => {
            console.error(err);
            loader.innerHTML = '<p class="text-red-400 font-semibold">Erro ao carregar detalhes.</p>';
        });
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    document.body.style.overflow = '';
    currentModalBudgetId = null;
    setTimeout(() => modal.classList.add('hidden'), 300);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetailModal(); });

function renderModalContent(d) {
    document.getElementById('modal-title').textContent = d.piece_name || 'Sem nome';
    const _dt = d.created_at ? new Date(d.created_at) : null;
    document.getElementById('modal-date').textContent = _dt && !isNaN(_dt)
        ? _dt.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '';

    const params = [
        { label: 'Peso Total',      value: (d.piece_weight_g || 0).toFixed(1) + 'g', icon: '⚖️' },
        { label: 'Tempo Impressão', value: formatTime(d.print_time_h),               icon: '🖨️' },
        { label: 'Tempo Manual',    value: formatTime(d.manual_time_h),              icon: '🔧' },
        { label: 'Preço Filamento', value: fc(d.filament_price_kg) + '/kg',          icon: '🧵' },
        { label: 'Depr./Hora',      value: fc(d.depreciation_per_hour),              icon: '⚙️' },
        { label: 'Mão-de-obra/Hora',value: fc(d.labor_per_hour),                     icon: '👷' },
        { label: 'Risco',           value: (d.risk_rate || 0).toFixed(0) + '%',      icon: '🛡️' },
        { label: 'Margem',          value: (d.margin_percent || 0).toFixed(0) + '%', icon: '📈' },
    ];
    if (d.value_multiplier > 1) params.push({ label: 'Multiplicador', value: '×' + d.value_multiplier.toFixed(1), icon: '✖️' });
    if (d.lot_quantity > 1) params.push({ label: 'Lote', value: d.lot_quantity + ' peças', icon: '📦' });

    document.getElementById('modal-params').innerHTML = params.map(p =>
        `<div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <div class="text-[10px] text-gray-400 font-bold uppercase">${p.icon} ${p.label}</div>
            <div class="text-sm font-bold text-gray-700 dark:text-gray-200 mt-0.5">${p.value}</div>
        </div>`
    ).join('');

    const filSec = document.getElementById('modal-filaments-section');
    const filDiv = document.getElementById('modal-filaments');
    if (d.filaments?.length) {
        filSec.classList.remove('hidden');
        filDiv.innerHTML = d.filaments.map(f =>
            `<div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                <div class="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex-shrink-0" style="background:${f.color || '#ccc'}"></div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate">${f.name || 'Filamento'}</div>
                    <div class="text-[10px] text-gray-400">${(f.weight_g || 0).toFixed(1)}g • ${fc(f.price_kg)}/kg</div>
                </div>
                <div class="text-xs font-bold text-indigo-500">${fc((f.weight_g / 1000) * f.price_kg)}</div>
            </div>`
        ).join('');
    } else filSec.classList.add('hidden');

    const supSec = document.getElementById('modal-supplies-section');
    const supDiv = document.getElementById('modal-supplies');
    if (d.supplies?.length) {
        supSec.classList.remove('hidden');
        supDiv.innerHTML = d.supplies.map(s =>
            `<div class="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                <div>
                    <div class="text-xs font-semibold">${s.name || 'Insumo'}</div>
                    <div class="text-[10px] text-gray-400">${fc(s.price)} / pct ${s.qty_pack || 1} un — usar ${s.use || 1}</div>
                </div>
                <div class="text-xs font-bold text-amber-500">${fc(s.unit_cost)}</div>
            </div>`
        ).join('');
    } else supSec.classList.add('hidden');

    const rows = [
        { label: 'Filamento',   value: d.filament_cost,     color: 'text-indigo-500' },
        { label: 'Energia',     value: d.energy_cost,       color: 'text-yellow-500' },
        { label: 'Depreciação', value: d.depreciation_cost, color: 'text-blue-500' },
        { label: 'Mão-de-obra', value: d.labor_cost,        color: 'text-pink-500' },
    ];
    if (d.supplies_cost > 0) rows.push({ label: 'Insumos', value: d.supplies_cost, color: 'text-amber-500' });
    rows.push({ label: 'Subtotal', value: d.subtotal, color: 'text-gray-500', separator: true });
    rows.push({ label: `Risco (${(d.risk_rate || 0).toFixed(0)}%)`, value: d.risk_cost, color: 'text-orange-500' });
    rows.push({ label: 'CUSTO TOTAL', value: d.total_cost, color: 'text-white', bold: true, highlight: true });

    document.getElementById('modal-breakdown').innerHTML = rows.map(r => {
        let cls = 'flex items-center justify-between py-1.5';
        if (r.separator) cls += ' border-t border-gray-200 dark:border-gray-700 pt-2 mt-1';
        if (r.highlight) cls += ' bg-indigo-500 -mx-4 px-4 py-2 rounded-lg mt-2';
        return `<div class="${cls}">
            <span class="text-xs ${r.bold ? 'font-extrabold' : 'font-medium'} ${r.highlight ? 'text-white' : 'text-gray-500'}">${r.label}</span>
            <span class="text-sm font-bold ${r.color}">${fc(r.value)}</span>
        </div>`;
    }).join('');

    document.getElementById('modal-final-price').textContent = fc(d.final_price);
    const lotInfo = document.getElementById('modal-lot-info');
    if (d.lot_quantity > 1) {
        lotInfo.textContent = `Lote de ${d.lot_quantity} peças • Total: ${fc(d.final_price * d.lot_quantity)}`;
        lotInfo.classList.remove('hidden');
    } else { lotInfo.classList.add('hidden'); }

    document.getElementById('modal-refs').innerHTML =
        `<div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100%</div>
            <div class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">${fc(d.price_100)}</div>
        </div>
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <div class="text-[10px] text-blue-600 dark:text-blue-400 font-bold">200%</div>
            <div class="text-sm font-extrabold text-blue-600 dark:text-blue-400">${fc(d.price_200)}</div>
        </div>
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
            <div class="text-[10px] text-purple-600 dark:text-purple-400 font-bold">400%</div>
            <div class="text-sm font-extrabold text-purple-600 dark:text-purple-400">${fc(d.price_400)}</div>
        </div>`;
}
