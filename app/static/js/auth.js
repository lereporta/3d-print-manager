// ===== AUTH FLOW =====
const API = '/api/auth';

const tabs = document.querySelectorAll('.tab');
const panels = {
    login: document.getElementById('form-login'),
    register: document.getElementById('form-register'),
    forgot: document.getElementById('form-forgot'),
    reset: document.getElementById('form-reset'),
};
const msgEl = document.getElementById('msg');

function showMsg(text, type = 'info') {
    msgEl.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-emerald-100', 'text-emerald-700', 'bg-blue-100', 'text-blue-700');
    const styles = {
        error:   ['bg-red-100', 'text-red-700'],
        success: ['bg-emerald-100', 'text-emerald-700'],
        info:    ['bg-blue-100', 'text-blue-700'],
    };
    msgEl.classList.add(...(styles[type] || styles.info));
    msgEl.textContent = text;
}

function switchTab(name) {
    Object.values(panels).forEach(p => p.classList.remove('active'));
    panels[name]?.classList.add('active');
    tabs.forEach(t => {
        const active = t.dataset.tab === name;
        t.classList.toggle('tab-active', active);
        t.classList.toggle('text-gray-600', !active);
    });
    msgEl.classList.add('hidden');
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ── Detecta token na URL → modo reset ──
const params = new URLSearchParams(window.location.search);
const resetToken = params.get('token');
if (resetToken && window.location.pathname.includes('reset-password')) {
    document.getElementById('tabs').style.display = 'none';
    switchTab('reset');
}

// ── LOGIN ──
panels.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(panels.login));
    try {
        const r = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.detail || 'Falha no login');
        saveSession(json);
        window.location.href = '/';
    } catch (err) {
        showMsg(err.message, 'error');
    }
});

// ── REGISTER ──
panels.register.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(panels.register));
    try {
        const r = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.detail || 'Falha no cadastro');
        saveSession(json);
        showMsg('Conta criada! Redirecionando...', 'success');
        setTimeout(() => window.location.href = '/', 800);
    } catch (err) {
        showMsg(err.message, 'error');
    }
});

// ── FORGOT ──
panels.forgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(panels.forgot));
    try {
        const r = await fetch(`${API}/request-password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        showMsg('✅ Uma notificação foi enviada ao administrador. Aguarde o contato.', 'success');
        panels.forgot.reset();
    } catch (err) {
        showMsg('Erro ao processar solicitação.', 'error');
    }
});

// ── RESET ──
panels.reset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(panels.reset);
    const newPass = fd.get('new_password');
    const confirm = fd.get('confirm');
    if (newPass !== confirm) {
        showMsg('As senhas não coincidem.', 'error');
        return;
    }
    try {
        const r = await fetch(`${API}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, new_password: newPass }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.detail || 'Token inválido');
        showMsg('✅ Senha atualizada! Redirecionando para login...', 'success');
        setTimeout(() => window.location.href = '/login', 1500);
    } catch (err) {
        showMsg(err.message, 'error');
    }
});

function saveSession(json) {
    localStorage.setItem('jwt_token', json.access_token);
    localStorage.setItem('user', JSON.stringify(json.user));
}

