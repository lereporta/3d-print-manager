document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[action^="/queue/"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            const inlineHandler = form.getAttribute('onsubmit');
            if (inlineHandler) {
                try { if (!eval(inlineHandler)) { e.preventDefault(); return; } } catch(_) {}
            }
            e.preventDefault();
            const action = form.getAttribute('action');
            try {
                const res = await fetch(action, {
                    method: 'POST',
                    body: new FormData(form),
                    redirect: 'follow'
                });
                if (res.ok || res.redirected) {
                    location.reload();
                } else {
                    const txt = await res.text().catch(() => '');
                    console.error('[queue] erro', res.status, txt);
                    alert('Erro (' + res.status + ')');
                }
            } catch (err) {
                console.error('[queue] network error:', err);
                alert('Erro de rede: ' + err.message);
            }
        });
    });
});

function confirmDelete(msg) { return window.confirm(msg || 'Tem certeza?'); }
