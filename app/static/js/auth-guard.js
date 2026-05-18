// ===== AUTH GUARD — protege todas as páginas internas =====
(function() {
    const token = localStorage.getItem('jwt_token');
    const path = window.location.pathname;

    // Páginas públicas
    const publicPages = ['/login', '/reset-password'];
    if (publicPages.some(p => path.startsWith(p))) return;

    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Decodifica payload para uso global
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        if (Date.now() >= exp) {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
        }
        window.__USER__ = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            is_admin: payload.is_admin === true,
        };
    } catch (e) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login';
        return;
    }

    // ── Intercepta fetch para injetar Authorization ──
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        const t = localStorage.getItem('jwt_token');
        if (t) {
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${t}`);
            } else {
                init.headers['Authorization'] = `Bearer ${t}`;
            }
        }
        return originalFetch(input, init).then(response => {
            if (response.status === 401) {
                localStorage.removeItem('jwt_token');
                window.location.href = '/login';
            }
            return response;
        });
    };

    // ── Logout helper ──
    window.logout = function() {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };
})();

