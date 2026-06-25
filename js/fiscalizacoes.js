/* ============================================================
   VISA Careiro — Fiscalizações
   Registro de ações de fiscalização (log histórico).
   ============================================================ */

// ---------- Render ----------
function renderFiscalizacoes() {
    const lista = getFiscalizacoesData();
    const container = document.getElementById('fiscalizacoesList');
    if (!container) return;

    const busca = (document.getElementById('searchFiscalizacoes')?.value || '').toLowerCase().trim();
    const filtrado = busca
        ? lista.filter(f =>
            [f.estabelecimento, f.fiscal, f.tipo, f.descricao, f.data]
                .map(v => v || '').join(' ').toLowerCase().includes(busca))
        : lista;

    const count = document.getElementById('fiscalizacoesCount');
    if (count) count.textContent = filtrado.length + ' registro' + (filtrado.length !== 1 ? 's' : '');

    if (!filtrado.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="icon">📋</div>
            <h3>${busca ? 'Nenhum resultado para "' + esc(busca) + '"' : 'Nenhuma fiscalização registrada'}</h3>
            <p>${busca ? 'Tente outros termos.' : 'Adicione o registro de uma ação de fiscalização.'}</p>
        </div>`;
        return;
    }

    // Ordena por data decrescente
    const ordenado = [...filtrado].sort((a, b) => {
        const da = a.data ? new Date(a.data) : new Date(0);
        const db = b.data ? new Date(b.data) : new Date(0);
        return db - da;
    });

    const tipoCores = {
        'Vistoria':        { bg: '#e8f4ff', color: '#3a7dc9', border: '#b0d4f5' },
        'Notificação':     { bg: '#fff4e0', color: '#7a4e00', border: '#f6c341' },
        'Autuação':        { bg: '#fdeef0', color: '#e05a6b', border: '#f9c0c7' },
        'Interdição':      { bg: '#f5e8ef', color: '#8a2848', border: '#f5c6d4' },
        'Orientação':      { bg: '#e8f8ee', color: '#2d7a4f', border: '#b0e6c4' },
        'Reinspeção':      { bg: '#fffbeb', color: '#7a5c00', border: '#fde68a' },
    };

    container.innerHTML = ordenado.map((f, i) => {
        const cor = tipoCores[f.tipo] || { bg: '#f5f0f2', color: 'var(--text-muted)', border: '#ddd' };
        const idx = lista.indexOf(f); // índice real para editar/remover
        return `
        <div class="fisc-item">
            <div class="fisc-item-header">
                <div class="fisc-estab">🏪 ${esc(f.estabelecimento) || '—'}</div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    ${f.tipo ? `<span style="display:inline-block;padding:2px 10px;border-radius:50px;font-size:11px;font-weight:700;background:${cor.bg};color:${cor.color};border:1px solid ${cor.border}">${esc(f.tipo)}</span>` : ''}
                    <span class="fisc-data">📅 ${f.data ? formatDate(f.data) : '—'}</span>
                    <button class="action-btn edit" onclick="openEditFiscalizacao(${idx})" title="Editar">✏️</button>
                    <button class="action-btn del"  onclick="removeFiscalizacao(${idx})"  title="Remover">🗑️</button>
                </div>
            </div>
            <div class="fisc-item-body">
                ${f.fiscal ? `<span style="font-size:12px;color:var(--text-muted);margin-right:12px">👤 <strong>${esc(f.fiscal)}</strong></span>` : ''}
                ${f.descricao ? `<span>${esc(f.descricao)}</span>` : '<span style="color:var(--text-muted);font-style:italic">Sem descrição.</span>'}
            </div>
        </div>`;
    }).join('');
}

// ---------- Abrir modal ----------
function openAddFiscalizacao() {
    document.getElementById('fiscModalTitle').textContent = '＋ Nova Fiscalização';
    document.getElementById('fiscEstabelecimento').value  = '';
    document.getElementById('fiscFiscal').value           = _currentUser?.profile?.nome || '';
    document.getElementById('fiscTipo').value             = '';
    document.getElementById('fiscData').value             = new Date().toISOString().slice(0, 10);
    document.getElementById('fiscDescricao').value        = '';
    document.getElementById('fiscEditId').value           = '';

    // Pre-preenche bairro select
    refreshFiscalizacaoBairroDropdown();
    openModal('modalFiscalizacao');
}

function openEditFiscalizacao(index) {
    const lista = getFiscalizacoesData();
    const f     = lista[index];
    if (!f) return;
    document.getElementById('fiscModalTitle').textContent = '✏️ Editar Fiscalização';
    document.getElementById('fiscEstabelecimento').value  = f.estabelecimento || '';
    document.getElementById('fiscFiscal').value           = f.fiscal           || '';
    document.getElementById('fiscTipo').value             = f.tipo             || '';
    document.getElementById('fiscData').value             = f.data             || '';
    document.getElementById('fiscDescricao').value        = f.descricao        || '';
    document.getElementById('fiscEditId').value           = index;
    openModal('modalFiscalizacao');
}

function refreshFiscalizacaoBairroDropdown() {
    const sel = document.getElementById('fiscEstabelecimentoSel');
    if (!sel) return;
    const ativos   = DADOS.filter(r => !isDisabled(r.id));
    const cur      = sel.value;
    sel.innerHTML  = '<option value="">Selecionar estabelecimento...</option>' +
        [...ativos]
            .sort((a, b) => (a.nome_fantasia || '').localeCompare(b.nome_fantasia || ''))
            .map(r => `<option value="${esc(r.nome_fantasia)}">${esc(r.nome_fantasia)}${r.bairro ? ' — ' + esc(r.bairro) : ''}</option>`)
            .join('');
    if (cur) sel.value = cur;
}

function onFiscalizacaoSelChange() {
    const sel   = document.getElementById('fiscEstabelecimentoSel');
    const input = document.getElementById('fiscEstabelecimento');
    if (sel && input && sel.value) input.value = sel.value;
}

// ---------- Salvar ----------
function saveFiscalizacao() {
    const estabelecimento = document.getElementById('fiscEstabelecimento').value.trim();
    const fiscal          = document.getElementById('fiscFiscal').value.trim();
    const tipo            = document.getElementById('fiscTipo').value;
    const data            = document.getElementById('fiscData').value;
    const descricao       = document.getElementById('fiscDescricao').value.trim();
    const editId          = document.getElementById('fiscEditId').value;

    if (!estabelecimento) { showToast('Informe o estabelecimento!', 'error'); return; }
    if (!tipo)            { showToast('Selecione o tipo de ação!', 'error'); return; }
    if (!data)            { showToast('Informe a data!', 'error'); return; }

    const entry = {
        estabelecimento,
        fiscal: fiscal || _currentUser?.profile?.nome || _currentUser?.email || 'Fiscal',
        tipo,
        data,
        descricao,
        registradoEm: new Date().toISOString()
    };

    const lista = getFiscalizacoesData();
    if (editId !== '') {
        const idx = parseInt(editId);
        if (idx >= 0 && idx < lista.length) { lista[idx] = entry; showToast('Fiscalização atualizada! ✅', 'success'); }
        else { showToast('Erro ao atualizar.', 'error'); return; }
    } else {
        lista.push(entry);
        showToast('Fiscalização registrada! ✅', 'success');
    }

    saveFiscalizacoesData(lista);
    closeModal('modalFiscalizacao');
    renderFiscalizacoes();
}

// ---------- Remover ----------
function removeFiscalizacao(index) {
    if (!confirm('Remover este registro de fiscalização?')) return;
    const lista = getFiscalizacoesData();
    lista.splice(index, 1);
    saveFiscalizacoesData(lista);
    renderFiscalizacoes();
    showToast('Registro removido.', 'success');
}

// ---------- Imprimir ----------
function imprimirFiscalizacoes() {
    const lista = getFiscalizacoesData();
    if (!lista.length) { showToast('Nenhuma fiscalização para imprimir!', 'error'); return; }

    const now     = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const ordenado = [...lista].sort((a, b) => {
        const da = a.data ? new Date(a.data) : new Date(0);
        const db = b.data ? new Date(b.data) : new Date(0);
        return db - da;
    });

    const rows = ordenado.map((f, i) => `<tr>
        <td style="text-align:center;font-weight:600">${i + 1}</td>
        <td style="font-weight:600">${esc(f.estabelecimento) || '—'}</td>
        <td>${esc(f.tipo) || '—'}</td>
        <td>${f.data ? formatDate(f.data) : '—'}</td>
        <td>${esc(f.fiscal) || '—'}</td>
        <td style="font-size:11px;color:#555">${esc(f.descricao) || '—'}</td>
    </tr>`).join('');

    const html = `
        <div class="print-header">
            <div>
                <div style="font-size:12px;opacity:.85;margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Prefeitura Municipal de Careiro — AM</div>
                <h1>CADVISA</h1>
                <div style="font-size:13px;opacity:.9;margin-top:4px">Vigilância Sanitária — Registro de Fiscalizações</div>
            </div>
            <div class="print-meta"><div><strong>Data:</strong> ${dateStr} &nbsp;|&nbsp; <strong>Hora:</strong> ${timeStr}</div></div>
        </div>
        <div class="print-body">
            <div class="print-section-title">📊 Resumo</div>
            <div class="print-summary">
                <div class="print-stat"><div class="pv">${lista.length}</div><div class="pl">Total</div></div>
            </div>
            <div class="print-section-title">📋 Registros</div>
            <table>
                <thead><tr><th>#</th><th>Estabelecimento</th><th>Tipo</th><th>Data</th><th>Fiscal</th><th>Descrição</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="print-footer">
                <div>
                    <div style="font-size:12px;color:#555;margin-bottom:32px">Responsável pela Emissão:</div>
                    <div class="sign-line">Chefe da Vigilância Sanitária Municipal</div>
                </div>
                <div>
                    <div style="font-size:12px;color:#555;margin-bottom:32px">Fiscal Responsável:</div>
                    <div class="sign-line">${esc(_currentUser?.profile?.nome || 'Fiscal Sanitário')}</div>
                </div>
            </div>
            <div style="margin-top:16px;padding:8px 12px;background:#f9f9f9;border-radius:6px;font-size:9px;color:#888;text-align:center">
                CADVISA — ${dateStr} às ${timeStr} — ${lista.length} registros
            </div>
        </div>`;

    imprimirHTML(html);
}