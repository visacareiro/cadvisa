/* ============================================================
   VISA Careiro — Estado Global e Cache Firebase
   Edite aqui os dados padrão de bairros e configurações.
   ============================================================ */

// ---------- Estado de UI ----------
let DADOS = [];
let _DADOS_ORIGINAL = [];
let currentPage = 'dashboard';
let currentEstabPage = 1;
let currentInativosPage = 1;
const PAGE_SIZE = 20;
let filters = { q: '', bairro: '', categoria: '', risco: '', status: '', dataInicio: '', dataFim: '' };
let _currentUser = null; // Usuário do Firebase Auth
let _currentUserName = null; // Nome do usuário selecionado (para logs e exibição)

// Recupera sessão salva (Firebase Auth)
(function () {
    try {
        const s = sessionStorage.getItem('visa_session');
        if (s) _currentUser = JSON.parse(s);
        // Recupera nome do usuário selecionado do localStorage
        const userName = localStorage.getItem('visa_user_name');
        if (userName) _currentUserName = userName;
    } catch (e) {}
})();

// ---------- Getters/Setters para nome do usuário ----------
function getCurrentUserName() { return _currentUserName; }
function setCurrentUserName(name) {
    _currentUserName = name;
    try { localStorage.setItem('visa_user_name', name); } catch(e) {}
}

// ---------- Cache Firestore ----------
const _fbCache = {
    inspections: {},
    agents: [],
    config: {
        licenca: true,
        semFisc: true,
        cpfObrigatorio: true,
        permitirExclusaoInativos: false,
        mesesValidadeFiscalizacao: 4
    },
    custom: [],
    deleted: [],
    disabled: [],
    edited: {},
    bairros: [
        'ESTRADA DE AUTAZES', 'COMUNIDADE BOA VISTA', 'ESTRADA DO MANAQUIRI', 'JACAMIM',
        'P A PANELAO', 'PACATUBA', 'LAGO CASTANHO', 'ORGAOS PUBLICOS',
        'UBS E OUTRAS UNIDADES DE SAUDE', 'RAMAL TIMBO', 'COMUNIDADE DO TILHEIRO',
        'HOTEIS E POUSADAS', 'LAGO TILHEIRO', 'PURUPURU', 'PURUPURU RIO', 'ESCOLAS',
        'SAMAUMA', 'LAGO JANAUACA', 'SAO JOSE', 'RAMAL FLORESTA', 'MAMORI I',
        'LAGO TAPAGEM', 'MERCADO CENTRAL', 'CENTRO', 'BAIRRO NOVO', 'VISTA ALEGRE',
        'NOVO HORIZONTE', 'NOVA ESPERANCA', 'SEBASTIAO BORGES'
    ],
    inativos_data: [],
    cronograma_data: [],
    legislacao_data: [],
    fiscalizacoes_data: [],
    audit_logs: [],
    users: [] // Lista de usuários nomeados
};

// ---------- Persistência Firestore ----------
function _saveField(field, value) {
    _STATE_REF.set({ [field]: value }, { merge: true })
        .catch(e => console.error('Firestore write [' + field + ']:', e));
}

// ---------- Getters / Setters por domínio ----------
function getInspections()    { return _fbCache.inspections; }
function getAgents()         { return _fbCache.agents; }
function getConfig()         { return _fbCache.config; }

function getCustom()         { return _fbCache.custom; }
function saveCustom(d)       { _fbCache.custom = d; _saveField('custom', d); }

function getDeletedIds()     { return _fbCache.deleted; }
function saveDeletedIds(d)   { _fbCache.deleted = d; _saveField('deleted', d); }

function getDisabledIds()    { return _fbCache.disabled || []; }
function saveDisabledIds(d)  { _fbCache.disabled = d; _saveField('disabled', d); }
function isDisabled(id)      { return getDisabledIds().map(String).includes(String(id)); }

function getEditedMap()      { return _fbCache.edited; }
function saveEditedMap(d)    { _fbCache.edited = d; _saveField('edited', d); }

function getBairros()        { return _fbCache.bairros && _fbCache.bairros.length ? _fbCache.bairros : ['Centro']; }
function saveBairros(d)      { _fbCache.bairros = d; _saveField('bairros', d); }

function getInativosData()   { return _fbCache.inativos_data || []; }
async function saveInativosData(lista) {
    _fbCache.inativos_data = lista;
    try {
        await _INATIVOS_REF.set({ estabelecimentos: lista, updatedAt: new Date().toISOString() });
    } catch (e) { console.error(e); }
}

function getCronogramaData()     { return _fbCache.cronograma_data || []; }
function saveCronogramaData(d)   { _fbCache.cronograma_data = d; _saveField('cronograma_data', d); }

function getLegislacaoData()     { return _fbCache.legislacao_data || []; }
function saveLegislacaoData(d)   { _fbCache.legislacao_data = d; _saveField('legislacao_data', d); }

function getFiscalizacoesData()  { return _fbCache.fiscalizacoes_data || []; }
function saveFiscalizacoesData(d){ _fbCache.fiscalizacoes_data = d; _saveField('fiscalizacoes_data', d); }

// ---------- Gerenciamento de Usuários ----------
function getUsers() {
    // Se não houver usuários cadastrados, cria os padrões
    if (!_fbCache.users || _fbCache.users.length === 0) {
        _fbCache.users = [
            { id: 1, nome: 'Usuário 1' },
            { id: 2, nome: 'Usuário 2' }
        ];
        saveUsers(_fbCache.users);
    }
    return _fbCache.users;
}

function saveUsers(users) {
    _fbCache.users = users;
    _saveField('users', users);
}

// ---------- Log de Auditoria (com nome de usuário) ----------
function getAuditLogs() { return _fbCache.audit_logs || []; }

function saveAuditLogs(logs) {
    _fbCache.audit_logs = logs;
    _saveField('audit_logs', logs);
}

/**
 * Registra uma ação no log de auditoria.
 * @param {string} type      - 'cronograma' | 'estabelecimento' | 'configuracao'
 * @param {string} action    - 'criado' | 'atualizado' | 'ativado' | 'desativado' | 'excluido' | 'alterado' | 'adicionado' | 'removido'
 * @param {string} entity    - Nome da entidade (ex: 'Cronograma', 'Estabelecimento', 'Configuração')
 * @param {string} entityName - Nome específico do item (ex: 'Janeiro/2026', 'Mercado Central')
 * @param {string} details   - Descrição detalhada da ação
 */
function registrarLog(type, action, entity, entityName, details) {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const userName = getCurrentUserName() || 'Primeiro acesso';
    const entry = {
        id: Date.now(),
        type: type,
        action: action,
        entity: entity,
        entityName: entityName || '',
        details: details || '',
        user: _currentUser?.profile?.nome || _currentUser?.email || userName,
        usuario: userName, // Nome do usuário selecionado
        timestamp: agora.toISOString(),
        month: ano + '-' + mes,
        date: agora.toISOString().slice(0, 10),
        hora: agora.toTimeString().slice(0, 5)
    };

    const logs = getAuditLogs();
    logs.push(entry);
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);
    saveAuditLogs(logs);
}

/**
 * Retorna logs filtrados por mês (formato 'YYYY-MM')
 */
function getAuditLogsPorMes(month) {
    const logs = getAuditLogs();
    if (!month) return logs;
    return logs.filter(log => log.month === month);
}

/**
 * Retorna logs filtrados por tipo e mês
 */
function getAuditLogsFiltrados(type, month) {
    const logs = getAuditLogs();
    let filtrados = logs;
    if (type && type !== 'todos') {
        filtrados = filtrados.filter(log => log.type === type);
    }
    if (month) {
        filtrados = filtrados.filter(log => log.month === month);
    }
    return filtrados;
}

/**
 * Retorna estatísticas de logs por tipo para um determinado mês
 */
function getAuditStats(month) {
    const logs = month ? getAuditLogsPorMes(month) : getAuditLogs();
    const stats = {
        total: logs.length,
        cronograma: logs.filter(l => l.type === 'cronograma').length,
        estabelecimento: logs.filter(l => l.type === 'estabelecimento').length,
        configuracao: logs.filter(l => l.type === 'configuracao').length,
        porDia: {},
        porAcao: {}
    };

    logs.forEach(log => {
        const dia = log.date || log.timestamp?.slice(0, 10) || 'sem-data';
        stats.porDia[dia] = (stats.porDia[dia] || 0) + 1;
        const chave = log.action + ':' + log.type;
        stats.porAcao[chave] = (stats.porAcao[chave] || 0) + 1;
    });

    const diasOrdenados = Object.keys(stats.porDia).sort();
    stats.dias = diasOrdenados;
    stats.valoresDia = diasOrdenados.map(d => stats.porDia[d]);

    return stats;
}

// ---------- Reconstrução do array DADOS ----------
function rebuildDADOS() {
    const deleted = getDeletedIds().map(String);
    const edited  = getEditedMap();
    const custom  = getCustom();
    let base = _DADOS_ORIGINAL.filter(r => !deleted.includes(String(r.id)));
    base = base.map(r => edited[String(r.id)] ? { ...r, ...edited[String(r.id)] } : r);
    DADOS.length = 0;
    [...base, ...custom].forEach(r => DADOS.push(r));
}

// ========== CONFIGURAÇÕES DO ALVARÁ ==========
async function getConfigAlvara() {
    try {
        const doc = await _db.collection('alvara').doc('config').get();
        if (doc.exists) {
            return doc.data();
        } else {
            return {
                secretaria: 'Nubia Lima Pereira',
                coordenadora: 'Gisele Matta de Souza',
                portariaSecretaria: 'PORT. 005, DE 02 DE JANEIRO DE 2025',
                portariaCoordenadora: 'PORT. 256, DE 05 DE FEVEREIRO DE 2025'
            };
        }
    } catch (e) {
        console.error('Erro ao buscar config alvara:', e);
        return {
            secretaria: 'Nubia Lima Pereira',
            coordenadora: 'Gisele Matta de Souza',
            portariaSecretaria: 'PORT. 005, DE 02 DE JANEIRO DE 2025',
            portariaCoordenadora: 'PORT. 256, DE 05 DE FEVEREIRO DE 2025'
        };
    }
}

async function salvarConfigAlvara(secretaria, coordenadora, portariaSecretaria, portariaCoordenadora) {
    try {
        await _db.collection('alvara').doc('config').set({
            secretaria,
            coordenadora,
            portariaSecretaria,
            portariaCoordenadora
        });
    } catch (e) {
        console.error('Erro ao salvar config alvara:', e);
        throw e;
    }
}