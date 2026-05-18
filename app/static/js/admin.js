document.addEventListener('DOMContentLoaded', loadAdminDashboard);

async function loadAdminDashboard() {
    try {
        const r = await fetch('/api/admin/dashboard');
        if (!r.ok) { alert('Acesso negado ou erro.'); return; }
        const data = await r.json();
        renderDashboard(data);
        document.getElementById('admin-loading').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
    } catch (e) {
        console.error(e);
    }
}

function renderDashboard(d) {
    // Métricas
    document.getElementById('m-users').textContent = d.metrics.total_users;
    document.getElementById('m-budgets').textContent = d.metrics.total_budgets;
    document.getElementById('m-ticket').textContent = 'R$ ' + d.metrics.avg_ticket.toFixed(2);
    document.getElementById('m-margin').textContent = d.metrics.avg_margin_percent.toFixed(1) + '%';
    document.getElementById('m-revenue').textContent = 'R$ ' + d.metrics.total_revenue.toFixed(2);

    // Reset requests
    const rl = document.getElementById('reset-list');
    document.getElementById('reset-count').textContent = d.reset_requests.length;
    if (d.reset_requests.length === 0) {
        rl.innerHTML = '<p class="text-sm text-gray-400 italic">Nenhuma solicitação pendente.</p>';
    } else {
        rl.innerHTML = d.reset_requests.map(r => `
            <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                        <div class="font-semibold">${escapeHtml(r.user_name)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(r.user_email)} • ${r.created_at}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <input readonly value="${window.location.origin}${r.reset_link}"
                               class="flex-1 md:w-80 text-xs px-2 py-1 rounded border bg-white dark:bg-slate-900 dark:border-slate-600 font-mono">
                        <button onclick="copyLink(this, '${window.location.origin}${r.reset_link}')"
                                class="px-3 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold">📋 Copiar</button>
                        <button onclick="resolveReset(${r.id})"
                                class="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold">✅ Resolvido</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Spools
    const ls = document.getElementById('low-spools');
    if (d.low_spools.length === 0) {
        ls.innerHTML = '<p class="text-sm text-gray-400 italic">Nenhum carretel em estado crítico.</p>';
    } else {
        ls.innerHTML = d.low_spools.map(s => `
            <div class="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200">
                <div>
                    <div class="font-semibold">${escapeHtml(s.material)} ${escapeHtml(s.color)} — ${escapeHtml(s.name)}</div>
                    <div class="text-xs text-gray-500">Dono: ${escapeHtml(s.owner)} (${escapeHtml(s.owner_email)})</div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold text-red-600">${s.remaining_percent}%</div>
                    <div class="text-xs text-gray-500">${s.current_weight_g}g</div>
                </div>
            </div>
        `).join('');
    }

    // Feedbacks
    const fb = document.getElementById('feedbacks-list');
    if (d.feedbacks.length === 0) {
        fb.innerHTML = '<p class="text-sm text-gray-400 italic">Nenhum feedback ainda.</p>';
    } else {
        fb.innerHTML = d.feedbacks.map(f => `
            <div class="p-3 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold text-indigo-500">${escapeHtml(f.user_name)}</span>
                    <span class="text-xs text-gray-400">${f.timestamp}</span>
                </div>
                <div class="text-sm">${escapeHtml(f.text)}</div>
            </div>
        `).join('');
    }

    // Top actions
    const ta = document.getElementById('top-actions');
    ta.innerHTML = d.top_actions.map(a => `
        <div class="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-center">
            <div class="text-xs text-gray-500 font-semibold">${escapeHtml(a.action)}</div>
            <div class="text-xl font-extrabold text-indigo-500">${a.count}</div>
        </div>
    `).join('');

    // Users
    document.getElementById('users-tbody').innerHTML = d.users.map(u => `
        <tr class="border-b dark:border-slate-700">
            <td class="p-2 font-semibold">${escapeHtml(u.name)}</td>
            <td class="p-2 text-gray-500">${escapeHtml(u.email)}</td>
            <td class="p-2 text-center">${u.is_admin ? '👑' : '—'}</td>
            <td class="p-2 text-center">${u.budgets_count}</td>
            <td class="p-2 text-center text-xs text-gray-500">${u.created_at}</td>
        </tr>
    `).join('');
}

async function resolveReset(id) {
    if (!confirm('Marcar como resolvido?')) return;
    const r = await fetch(`/api/admin/reset-requests/${id}/resolve`, { method: 'POST' });
    if (r.ok) loadAdminDashboard();
}

function copyLink(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = '✓ Copiado!';
        setTimeout(() => btn.textContent = old, 1500);
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

