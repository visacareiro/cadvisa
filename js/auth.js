/* ============================================================
   VISA Careiro — Autenticação (Firebase Auth)
   Login, logout, termos, troca de senha e troca de usuário.
   ============================================================ */

// ─── Login com Firebase Auth ──────────────────────────────
async function doLogin() {
    const email   = document.getElementById('loginEmail').value.trim().toLowerCase();
    const senha   = document.getElementById('loginSenha').value;
    const errEl   = document.getElementById('loginErr');
    const btn     = document.getElementById('loginBtn');

    errEl.style.display = 'none';
    if (!email || !senha) {
        errEl.textContent = 'Preencha e‑mail e senha.';
        errEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando…';

    try {
        const userCred = await _fbAuth.signInWithEmailAndPassword(email, senha);
        const user = userCred.user;

        const snap = await _USERS_REF.doc(user.uid).get();
        if (!snap.exists) {
            await _USERS_REF.doc(user.uid).set({
                email: user.email,
                role: 'fiscal',
                profile: { nome: user.email }
            });
            _currentUser = { uid: user.uid, email: user.email, role: 'fiscal', profile: { nome: user.email } };
        } else {
            _currentUser = { uid: user.uid, email: user.email, ...snap.data() };
        }

        try { sessionStorage.setItem('visa_session', JSON.stringify(_currentUser)); } catch (e) {}

        btn.textContent = 'Entrando…';
        await boot(); // boot agora cuida de verificar usuário selecionado

    } catch (err) {
        console.error('Login error:', err);
        let msg = 'E‑mail ou senha inválidos.';
        if (err.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
        else if (err.code === 'auth/wrong-password') msg = 'Senha incorreta.';
        else if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Tente novamente mais tarde.';
        errEl.textContent = msg;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

// ─── Logout com limpeza total do cache local ──────────────
async function doLogout() {
    if (!confirm('Deseja sair do sistema?')) return;

    // 1. Limpa localStorage e sessionStorage
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn('Erro ao limpar storages:', e);
    }

    // 2. Limpa todos os caches do Service Worker (se houver)
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log('[Cache] Todos os caches foram limpos.');
        } catch (e) {
            console.warn('[Cache] Erro ao limpar caches:', e);
        }
    }

    // 3. Desconecta do Firebase
    await _fbAuth.signOut();
    _currentUser = null;
    _currentUserName = null;

    // 4. Reseta a interface para a tela de login
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginSenha').value = '';
    document.getElementById('loginErr').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').textContent = 'Entrar';
    document.getElementById('loadingOverlay').style.display = 'none';
}

// ─── Termos de Uso ──────────────────────────────────────────
function verificarTermos() {
    const aceitos = localStorage.getItem('visa_terms_accepted');
    if (_currentUser && !aceitos) {
        openModal('modalTermos');
        return false;
    }
    return true;
}

// CORREÇÃO: após carregar os dados, chama a função global posCarregamento
async function aceitarTermos() {
    try { localStorage.setItem('visa_terms_accepted', '1'); } catch (e) {}
    closeModal('modalTermos');
    document.getElementById('loadingOverlay').style.display = 'flex';
    await carregarDadosRemotos();
    // Chama a função centralizada de pós-carregamento (definida em app.js)
    if (typeof window.posCarregamento === 'function') {
        window.posCarregamento();
    } else {
        // Fallback (caso a função ainda não esteja disponível)
        const userName = localStorage.getItem('visa_user_name');
        if (!userName) {
            document.getElementById('loadingOverlay').style.display = 'none';
            openModal('modalSelectUser');
            renderUserSelectionModal();
        } else {
            setCurrentUserName(userName);
            atualizarNomeUsuario(userName);
            document.getElementById('loadingOverlay').style.display = 'none';
            init();
        }
    }
}

function rejeitarTermos() {
    try { localStorage.removeItem('visa_terms_accepted'); } catch (e) {}
    closeModal('modalTermos');
    doLogout();
}

// ─── Troca de senha (com log) ──────────────────────────────
async function changeAdminPassword() {
    const newPass = (document.getElementById('newPasswordAdmin')?.value || '').trim();
    const confirm = (document.getElementById('confirmPasswordAdmin')?.value || '').trim();

    if (!newPass || newPass.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
        return;
    }
    if (newPass !== confirm) {
        showToast('As senhas não coincidem.', 'error');
        return;
    }

    try {
        const user = _fbAuth.currentUser;
        if (!user) throw new Error('Nenhum usuário autenticado.');
        await user.updatePassword(newPass);
        document.getElementById('newPasswordAdmin').value = '';
        document.getElementById('confirmPasswordAdmin').value = '';
        registrarLog('configuracao', 'alterado', 'Configuração', 'Senha',
            'Senha do usuário ' + (user.email || '') + ' foi alterada.');
        showToast('Senha alterada com sucesso! ✅', 'success');
        renderPainelRegistro();
    } catch (err) {
        console.error('Erro ao alterar senha:', err);
        let msg = 'Erro ao alterar senha.';
        if (err.code === 'auth/requires-recent-login') {
            msg = 'Por segurança, faça login novamente antes de alterar a senha.';
        }
        showToast(msg, 'error');
    }
}

// ─── Verificação de senha ──────────────────────────────────
let _pendingPasswordCallback = null;

async function verifyAdminPassword(password) {
    const user = _fbAuth.currentUser;
    if (!user) return false;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    try {
        await user.reauthenticateWithCredential(credential);
        return true;
    } catch (e) {
        return false;
    }
}

function promptAdminPassword(successCallback, cancelCallback) {
    _pendingPasswordCallback = { success: successCallback, cancel: cancelCallback || (() => {}) };
    const input = document.getElementById('promptPasswordInput');
    const errorEl = document.getElementById('promptPasswordError');
    if (input) input.value = '';
    if (errorEl) errorEl.style.display = 'none';
    openModal('modalPasswordPrompt');
    setTimeout(() => document.getElementById('promptPasswordInput')?.focus(), 100);
}

async function confirmPasswordAction() {
    const password = document.getElementById('promptPasswordInput')?.value || '';
    if (!password) {
        const errorEl = document.getElementById('promptPasswordError');
        if (errorEl) { errorEl.textContent = 'Digite a senha.'; errorEl.style.display = 'block'; }
        return;
    }
    const isValid = await verifyAdminPassword(password);
    if (isValid) {
        closeModal('modalPasswordPrompt');
        const cb = _pendingPasswordCallback?.success;
        _pendingPasswordCallback = null;
        if (cb) cb();
    } else {
        const errorEl = document.getElementById('promptPasswordError');
        if (errorEl) { errorEl.textContent = 'Senha incorreta.'; errorEl.style.display = 'block'; }
    }
}

function cancelPasswordAction() {
    closeModal('modalPasswordPrompt');
    const cb = _pendingPasswordCallback?.cancel;
    _pendingPasswordCallback = null;
    if (cb) cb();
}

// ─── Trocar Usuário (solicita senha antes de abrir o modal) ──
function promptChangeUser() {
    promptAdminPassword(
        () => {
            // Senha correta → abre o modal de seleção de usuário
            openModal('modalSelectUser');
            renderUserSelectionModal();
        },
        () => {
            // Cancelado → não faz nada
        }
    );
}