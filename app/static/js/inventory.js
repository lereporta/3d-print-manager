// ===== INVENTORY — carrega e gerencia carretéis via JWT =====
// (auth-guard.js já injeta Authorization: Bearer em todo fetch)

document.addEventListener('DOMContentLoaded', () => {
    loadSpools();

    document.getElementById('form-add-spool').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        try {
            const r = await fetch('/inventory/add', { method: 'POST', body: fd });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.detail || 'Erro ao cadastrar');
            }
            showToast('✅ Carretel cadastrado!');
            form.reset();
            // restaura defaults
            form.querySelector('[name=color]').value = 'Branco';
            form.querySelector('[name=color_hex]').value = '#FFFFFF';
            form.querySelector('[name=price_per_kg]').value = '120.00';
            form.querySelector('[name=initial_weight_g]').value = '1000';
            loadSpools();
        } catch (err) {
            showToast('❌ ' + err.message);
        }
    });
});

async function loadSpools() {
    try {
        const r = await fetch('/inventory/api/list');
        if (!r.ok) throw new Error('Erro ao carregar');
        const spools = await r.json();
        renderSpools(spools);
        updateStats(spools);
    } catch (err) {
        document.getElementById('spool-list').innerHTML =
            '<p class="text-red-400 text-center py-8">❌ ' + err.message + '</p>';
    }
}

function updateStats(spools) {
    const totalWeight = spools.reduce((sum, s) => sum + (s.current_weight_g || 0), 0);
    const lowCount = spools.filter(s => s.is_low).length;
    document.getElementById('stat-count').textContent = spools.length;
    document.getElementById('stat-total').textContent = Math.round(totalWeight) + 'g';
    document.getElementById('stat-low').textContent = lowCount;
}

function renderSpools(spools) {
    const container = document.getElementById('spool-list');
    if (!spools.length) {
        container.innerHTML = `
            <div class="text-center py-16">
                <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                <p class="text-gray-400 font-semibold mb-2">Nenhum carretel cadastrado</p>
                <p class="text-sm text-gray-400">Adicione seus carretéis para controlar o estoque.</p>
            </div>`;
        return;
    }

    container.innerHTML = '<div class="space-y-4">' + spools.map(s => spoolCard(s)).join('') + '</div>';
}

function spoolCard(s) {
    const borderClass = s.is_empty
        ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
        : s.is_low
            ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700';

    const fillClass = s.is_empty ? 'bg-red-500'
        : s.is_low ? 'bg-amber-500'
        : s.remaining_percent < 30 ? 'bg-yellow-500'
        : 'bg-emerald-500';

    const badge = s.is_empty
        ? '<span class="badge badge-urgent alert-pulse">VAZIO</span>'
        : s.is_low ? '<span class="badge badge-high alert-pulse">⚠️ BAIXO</span>' : '';

    const used = (s.initial_weight_g - s.current_weight_g).toFixed(0);

    return `
    <div class="p-4 rounded-xl border transition-all ${borderClass}">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="spool-dot" style="background:${s.color_hex}"></span>
                    <h4 class="font-bold">${escapeHtml(s.name)}</h4>
                    <span class="badge badge-low">${escapeHtml(s.material)}</span>
                    <span class="text-xs text-gray-400">${escapeHtml(s.color)}</span>
                    ${badge}
                </div>
                <div class="mt-1">
                    <span class="text-xs font-semibold text-indigo-500">R$ ${s.price_per_kg.toFixed(2)}/kg</span>
                </div>
                <div class="mt-2 space-y-1">
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">${s.current_weight_g.toFixed(0)}g restantes de ${s.initial_weight_g.toFixed(0)}g</span>
                        <span class="font-semibold ${s.is_low ? 'text-red-500' : 'text-indigo-500'}">${s.remaining_percent}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${fillClass}" style="width: ${s.remaining_percent}%"></div>
                    </div>
                    <p class="text-xs text-gray-400">Usado: ${used}g (${s.usage_percent}%)</p>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <form onsubmit="return updateSpool(event, ${s.id})" class="flex items-center gap-1 flex-wrap">
                    <div class="input-group" style="width: 100px;">
                        <input type="number" step="1" min="0" name="current_weight_g"
                               value="${s.current_weight_g.toFixed(0)}"
                               class="input-field has-suffix text-xs py-1 px-2" title="Peso atual (g)">
                        <span class="input-suffix text-xs">g</span>
                    </div>
                    <div class="input-group" style="width: 110px;">
                        <span class="input-prefix text-xs">R$</span>
                        <input type="number" step="0.01" min="0" name="price_per_kg"
                               value="${s.price_per_kg.toFixed(2)}"
                               class="input-field has-prefix has-suffix text-xs py-1 px-2" title="Preço por kg">
                        <span class="input-suffix text-xs">/kg</span>
                    </div>
                    <button type="submit" class="btn btn-ghost text-xs py-1 px-2" title="Atualizar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                </form>
                <button onclick="deleteSpool(${s.id})" class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 self-end" title="Remover">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
    </div>`;
}

async function updateSpool(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
        const r = await fetch('/inventory/edit/' + id, { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Erro ao atualizar');
        showToast('✅ Carretel atualizado!');
        loadSpools();
    } catch (err) {
        showToast('❌ ' + err.message);
    }
    return false;
}

async function deleteSpool(id) {
    if (!confirm('Remover este carretel?')) return;
    try {
        const r = await fetch('/inventory/delete/' + id, { method: 'POST' });
        if (!r.ok) throw new Error('Erro ao remover');
        showToast('🗑️ Carretel removido!');
        loadSpools();
    } catch (err) {
        showToast('❌ ' + err.message);
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

