/* ============================================================
   VISA Careiro — Utilitários
   Funções puras de formatação, badges e UI helpers.
   ============================================================ */

// ---------- Sanitização HTML ----------
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------- Formatação de Data ----------
function formatDate(d) {
    if (!d) return '—';
    try {
        const parts = d.toString().slice(0, 10).split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        const dt = new Date(d);
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString('pt-BR');
    } catch { return d; }
}

// ---------- Status de Fiscalização ----------
// O prazo de validade é lido da configuração (padrão 4 meses)
function getStatusByLicense(licenseDate) {
    if (!licenseDate) return 'pendente';
    const licDate = new Date(licenseDate + 'T00:00:00');
    if (isNaN(licDate.getTime())) return 'pendente';
    const expiry = new Date(licDate);
    // Lê o prazo da configuração, com fallback para 4
    const meses = getConfig().mesesValidadeFiscalizacao || 4;
    expiry.setMonth(expiry.getMonth() + meses);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now <= expiry ? 'fiscalizado' : 'pendente';
}

function getStatusForEstab(r) {
    return getStatusByLicense(r.ultimo_fiscalização);
}

// ---------- Badges HTML ----------
function statusBadge(st) {
    if (st === 'fiscalizado') return '<span class="badge badge-fiscalizado">✅ Fiscalizado</span>';
    return '<span class="badge badge-pendente">⏳ Pendente</span>';
}

function statusLabel(st) {
    return st === 'fiscalizado' ? 'Fiscalizado' : 'Pendente';
}

function licenciamentoBadge(lic) {
    if (lic === 'Sim') return '<span class="badge badge-fiscalizado">✅ Sim</span>';
    if (lic === 'Não') return '<span class="badge badge-pendente">❌ Não</span>';
    return '<span class="badge badge-sem">—</span>';
}

function riskBadge(r) {
    if (!r) return '<span class="badge badge-sem">Não informado</span>';
    if (r.includes('BAIXO')) return '<span class="badge badge-baixo">🟢 Baixo</span>';
    if (r.includes('ALTO'))  return '<span class="badge badge-alto">🔴 Alto</span>';
    return '<span class="badge badge-sem">' + esc(r) + '</span>';
}

function activeBadge(disabled) {
    return disabled
        ? '<span class="badge badge-inativo">🚫 Inativo</span>'
        : '<span class="badge badge-ativo">✅ Ativo</span>';
}

// ---------- Toast ----------
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = (type === 'success' ? '✅' : '❌') + ' ' + msg;
    c.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'slideOut .3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ---------- Modal ----------
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ---------- Sidebar ----------
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar()  { document.getElementById('sidebar').classList.remove('open'); }

// ---------- Download ----------
function downloadJSON(obj, filename) {
    downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function readJSON(file, cb) {
    const reader = new FileReader();
    reader.onload = ev => {
        try { cb(JSON.parse(ev.target.result)); }
        catch { showToast('Erro ao ler o arquivo JSON.', 'error'); }
    };
    reader.readAsText(file);
}

// ---------- Paginação (helper compartilhado) ----------
function buildPaginationHTML(cur, totalPages, goFnName) {
    let html = `<button class="page-btn" onclick="${goFnName}(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>‹</button>`;
    let range = [];
    if (totalPages <= 7) range = Array.from({ length: totalPages }, (_, i) => i + 1);
    else if (cur <= 4)              range = [1, 2, 3, 4, 5, '...', totalPages];
    else if (cur >= totalPages - 3) range = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    else                            range = [1, '...', cur - 1, cur, cur + 1, '...', totalPages];
    range.forEach(p => {
        if (p === '...') html += `<button class="page-btn" disabled>…</button>`;
        else html += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="${goFnName}(${p})">${p}</button>`;
    });
    html += `<button class="page-btn" onclick="${goFnName}(${cur + 1})" ${cur === totalPages ? 'disabled' : ''}>›</button>`;
    return html;
}