/* ============================================================
   VISA Careiro — App: Boot, Navegação e Inicialização
   ============================================================ */

// ---------- Navegação ----------
function navigateTo(page) {
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(el => {
        el.classList.toggle('active', el.id === 'page-' + page);
    });

    const titles = {
        dashboard:      '📊 Dashboard',
        estabelecimentos: '🏪 Estabelecimentos',
        inativos:       '🚫 Estabelecimentos Inativos',
        cronograma:     '📅 Cronograma',
        legislacao:     '📚 Legislação',
        fiscalizacoes:  '📋 Fiscalizações',
        configuracoes:  '⚙️ Configurações'
    };
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'CADVISA';

    if (page === 'dashboard')        renderDashboard();
    if (page === 'estabelecimentos') { renderTable(); updateCpfLabel(); refreshAllCategoryDropdowns(); refreshAllBairroDropdowns(); initCatDatalist(); }
    if (page === 'inativos')         renderInativos();
    if (page === 'cronograma')       renderCronograma();
    if (page === 'legislacao')       renderLegislacao();
    if (page === 'fiscalizacoes')    renderFiscalizacoes();
    if (page === 'configuracoes')    { renderConfig(); updateCpfLabel(); }

    closeSidebar();
}

// ---------- Função centralizada de pós-carregamento ----------
function posCarregamento() {
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
// Expõe globalmente para ser chamada de auth.js
window.posCarregamento = posCarregamento;

// ---------- Boot ----------
async function boot() {
    if (!_currentUser) {
        document.getElementById('loginOverlay').style.display = 'flex';
        return;
    }
    document.getElementById('loginOverlay').style.display = 'none';

    const termosAceitos = localStorage.getItem('visa_terms_accepted');
    if (!termosAceitos) {
        openModal('modalTermos');
        return;
    }

    const loadEl = document.getElementById('loadingOverlay');
    if (loadEl) loadEl.style.display = 'flex';
    await carregarDadosRemotos();

    // Agora usa a função centralizada
    posCarregamento();
}

// ---------- Carrega dados remotos ----------
async function carregarDadosRemotos() {
    const loadEl = document.getElementById('loadingOverlay');
    try {
        const snap = await _STATE_REF.get();
        if (snap.exists) {
            const d = snap.data();
            if (d.agents)              _fbCache.agents             = d.agents;
            if (d.config)              _fbCache.config             = d.config;
            if (d.custom)              _fbCache.custom             = d.custom;
            if (d.deleted)             _fbCache.deleted            = d.deleted;
            if (d.disabled)            _fbCache.disabled           = d.disabled;
            if (d.edited)              _fbCache.edited             = d.edited;
            if (d.bairros)             _fbCache.bairros            = d.bairros;
            if (d.cronograma_data)     _fbCache.cronograma_data    = d.cronograma_data;
            if (d.legislacao_data)     _fbCache.legislacao_data    = d.legislacao_data;
            if (d.fiscalizacoes_data)  _fbCache.fiscalizacoes_data = d.fiscalizacoes_data;
            if (d.audit_logs)          _fbCache.audit_logs         = d.audit_logs;
            if (d.users)               _fbCache.users              = d.users;
        }
    } catch (e) {
        console.warn('Firestore state indisponível:', e);
        showToast('⚠️ Sem conexão com a nuvem.', 'error');
    }

    try {
        const inativosSnap = await _INATIVOS_REF.get();
        if (inativosSnap.exists) {
            const id = inativosSnap.data();
            if (Array.isArray(id.estabelecimentos)) _fbCache.inativos_data = id.estabelecimentos;
        }
    } catch (e) { console.warn('Erro ao carregar inativos_data:', e); }

    let raw = [];
    try {
        const baseSnap = await _BASE_REF.get();
        if (baseSnap.exists) {
            const bd = baseSnap.data();
            if (Array.isArray(bd.estabelecimentos)) raw = bd.estabelecimentos;
        }
    } catch (e) { console.warn('Erro ao carregar dados base:', e); }

    _DADOS_ORIGINAL.length = 0;
    raw.forEach(r => _DADOS_ORIGINAL.push(r));

    if (loadEl) loadEl.style.display = 'none';
}

// ---------- Renderização do modal de seleção de usuário ----------
function renderUserSelectionModal() {
    const users = getUsers();
    const container = document.getElementById('selectUserList');
    if (!container) return;
    if (!users.length) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nenhum usuário cadastrado. Entre em contato com o administrador.</p>';
        return;
    }
    container.innerHTML = users.map(u => `
        <button class="btn btn-primary" style="width:100%;margin-bottom:8px;justify-content:center;" onclick="selectUser(${u.id})">
            ${esc(u.nome)}
        </button>
    `).join('');
}

// ---------- Seleção de usuário (com LOG) ----------
function selectUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;

    // ✅ LOG: registro da seleção do usuário
    registrarLog('configuracao', 'selecionado', 'Usuário', user.nome,
        'Usuário "' + user.nome + '" selecionado para uso do sistema.');

    setCurrentUserName(user.nome);
    closeModal('modalSelectUser');
    document.getElementById('loadingOverlay').style.display = 'flex';
    init();
    document.getElementById('loadingOverlay').style.display = 'none';
    atualizarNomeUsuario(user.nome);
    showToast('Usuário selecionado: ' + user.nome, 'success');
}

function atualizarNomeUsuario(nome) {
    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) sidebarName.textContent = nome || 'Usuário';
    // Se houver elemento na topbar (mobile), pode adicionar
    const topbarUser = document.getElementById('topbarUserName');
    if (topbarUser) topbarUser.textContent = nome || '';
}

// ---------- Init ----------
function init() {
    rebuildDADOS();
    refreshAllCategoryDropdowns();
    refreshAllBairroDropdowns();
    initCatDatalist();
    updateTopBadges();
    updateCpfLabel();
    renderDashboard();
    atualizarNomeUsuario(getCurrentUserName());

    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    if (nameEl) nameEl.textContent = _currentUser?.profile?.nome || _currentUser?.email || 'Usuário';
    if (roleEl) roleEl.textContent = _currentUser?.role === 'admin' ? 'Administrador' : 'Fiscal';
}

// ---------- DOMContentLoaded ----------
document.addEventListener('DOMContentLoaded', () => {

    const skipIds = new Set(['estCnae', 'estLicenca', 'loginEmail', 'loginSenha', 'legLink', 'estFiscDescricao']);
    function applyUppercase(el) {
        if (!el || skipIds.has(el.id)) return;
        if (['date', 'email', 'password', 'month'].includes(el.type)) return;
        if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
        const pos = el.selectionStart;
        el.value = el.value.toUpperCase();
        try { el.setSelectionRange(pos, pos); } catch (e) {}
    }
    document.addEventListener('input', e => {
        const el = e.target;
        if (el.classList.contains('form-input') || el.classList.contains('auto-upper') ||
            el.classList.contains('search-input') || el.id === 'newBairroName') {
            applyUppercase(el);
        }
    });

    const cpfCnpjInput = document.getElementById('estCpfCnpj');
    if (cpfCnpjInput) {
        cpfCnpjInput.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '');
            if (v.length <= 11) {
                v = v.replace(/(\d{3})(\d)/,       '$1.$2');
                v = v.replace(/(\d{3})(\d)/,       '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                v = v.slice(0, 14);
                v = v.replace(/(\d{2})(\d)/,       '$1.$2');
                v = v.replace(/(\d{3})(\d)/,       '$1.$2');
                v = v.replace(/(\d{3})(\d)/,       '$1/$2');
                v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            }
            this.value = v;
            validarCpfCnpjVisual(this);
        });
        cpfCnpjInput.addEventListener('blur', function () {
            validarCpfCnpjVisual(this);
        });
    }

    document.getElementById('loginSenha')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });

    // Nenhum fechamento automático de modal por clique no overlay
});

// Inicia o sistema (se já estiver logado, boot será chamado pelo auth)
// Mas como auth.js chama boot após login, e app.js também pode ser chamado diretamente,
// vamos garantir que boot seja chamado apenas uma vez.
// O boot já é chamado em auth.js após login, e também pode ser chamado no carregamento.
// Para evitar duplicidade, vamos verificar se já foi iniciado.
let _booted = false;
if (!_booted) {
    _booted = true;
    boot();
}