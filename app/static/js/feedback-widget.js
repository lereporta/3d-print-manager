// ===== BOTÃO FLUTUANTE DE FEEDBACK =====
(function() {
    if (!localStorage.getItem('jwt_token')) return;

    const btn = document.createElement('button');
    btn.id = 'feedback-fab';
    btn.innerHTML = '💡 Sugestões / Bugs';
    btn.title = 'Enviar feedback';
    btn.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 9999;
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        color: white; border: none; padding: .7rem 1.1rem;
        border-radius: 999px; font-weight: 700; font-size: .85rem;
        box-shadow: 0 6px 20px rgba(239,68,68,.35); cursor: pointer;
        transition: transform .15s;
    `;
    btn.onmouseenter = () => btn.style.transform = 'translateY(-2px)';
    btn.onmouseleave = () => btn.style.transform = '';

    btn.onclick = () => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,.5); display: flex;
            align-items: center; justify-content: center; padding: 1rem;
        `;
        modal.innerHTML = `
            <div style="background:white;border-radius:1rem;padding:1.5rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);" class="dark:bg-slate-800">
                <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:.5rem;" class="text-gray-800 dark:text-white">💡 Enviar sugestão ou reportar bug</h3>
                <p style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">Sua mensagem irá direto ao administrador.</p>
                <textarea id="fb-text" rows="5" placeholder="Descreva o que aconteceu ou sua sugestão..."
                    style="width:100%;padding:.7rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;resize:vertical;outline:none;"
                    class="dark:bg-slate-900 dark:border-slate-600 dark:text-white"></textarea>
                <div style="display:flex;gap:.5rem;margin-top:1rem;">
                    <button id="fb-cancel" style="flex:1;padding:.6rem;border-radius:.5rem;background:#e5e7eb;font-weight:600;">Cancelar</button>
                    <button id="fb-send" style="flex:1;padding:.6rem;border-radius:.5rem;background:linear-gradient(135deg,#6366f1,#06b6d4);color:white;font-weight:700;">Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#fb-cancel').onclick = () => modal.remove();
        modal.querySelector('#fb-send').onclick = async () => {
            const text = modal.querySelector('#fb-text').value.trim();
            if (text.length < 3) { alert('Escreva pelo menos 3 caracteres.'); return; }
            try {
                const r = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                });
                if (r.ok) {
                    modal.remove();
                    showFbToast('✅ Obrigado pelo feedback!');
                } else {
                    alert('Erro ao enviar.');
                }
            } catch (e) { alert('Erro de conexão.'); }
        };
    };

    document.body.appendChild(btn);

    function showFbToast(msg) {
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = `position:fixed;bottom:80px;right:20px;background:#10b981;color:white;padding:.7rem 1rem;border-radius:.5rem;z-index:10001;font-weight:600;box-shadow:0 4px 15px rgba(16,185,129,.4);`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
})();

