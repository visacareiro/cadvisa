/* ============================================================
   VISA Careiro — Estabelecimentos
   Tabela, filtros, busca, paginação e CRUD completo.
   ============================================================ */

// ---------- Filtros ----------
function filteredData() {
    const q = filters.q.toLowerCase().trim();
    return DADOS.filter(r => {
        if (isDisabled(r.id)) return false;
        if (filters.bairro    && r.bairro      !== filters.bairro)    return false;
        if (filters.categoria && r.categoria   !== filters.categoria)  return false;
        if (filters.risco     && r.classe_risco !== filters.risco)     return false;
        if (filters.status    && getStatusForEstab(r) !== filters.status) return false;

        if (filters.dataInicio || filters.dataFim) {
            const licDate = r.ultimo_fiscalização ? new Date(r.ultimo_fiscalização + 'T00:00:00') : null;
            if (!licDate || isNaN(licDate.getTime())) return false;
            if (filters.dataInicio) {
                const inicio = new Date(filters.dataInicio + 'T00:00:00');
                if (licDate < inicio) return false;
            }
            if (filters.dataFim) {
                const fim = new Date(filters.dataFim + 'T00:00:00');
                if (licDate > fim) return false;
            }
        }

        if (q) {
            const hay = [r.nome_fantasia, r.razao_social, r.endereco, r.tipo_atividade, r.cnae, r.categoria, r.bairro, r.cpf_cnpj]
                .map(v => v || '').join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function filteredDataInativos() {
    const q = (document.getElementById('searchInativos')?.value || '').toLowerCase().trim();
    return DADOS.filter(r => {
        if (!isDisabled(r.id)) return false;
        if (q) {
            const hay = [r.nome_fantasia, r.razao_social, r.endereco, r.tipo_atividade, r.cnae, r.categoria, r.bairro, r.cpf_cnpj]
                .map(v => v || '').join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function setFilter(type, val) { filters[type] = val; currentEstabPage = 1; if (currentPage === 'estabelecimentos') renderTable(); }
function onFilterCategoria()  { filters.categoria = document.getElementById('filterCategoria').value; currentEstabPage = 1; renderTable(); }
function onFilterRisco()      { filters.risco     = document.getElementById('filterRisco').value;     currentEstabPage = 1; renderTable(); }

function onSearch() {
    filters.q = document.getElementById('searchInput').value;
    currentEstabPage = 1;
    document.getElementById('searchClear').style.display = filters.q ? 'block' : 'none';
    renderTable();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filters.q = '';
    document.getElementById('searchClear').style.display = 'none';
    renderTable();
}

function resetEstabFilters() {
    filters = { q: '', bairro: '', categoria: '', risco: '', status: '', dataInicio: '', dataFim: '' };
    const si = document.getElementById('searchInput');
    if (si) { si.value = ''; document.getElementById('searchClear').style.display = 'none'; }
    ['filterBairro', 'filterCategoria', 'filterRisco', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['filterDataInicio', 'filterDataFim'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentEstabPage = 1;
    renderTable();
}

// ---------- Tabela de Ativos ----------
function renderTable() {
    const data  = filteredData();
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentEstabPage > totalPages) currentEstabPage = totalPages;
    const slice = data.slice((currentEstabPage - 1) * PAGE_SIZE, currentEstabPage * PAGE_SIZE);

    document.getElementById('resultCount').textContent = total + ' resultado' + (total !== 1 ? 's' : '');

    const tbody = document.getElementById('tableBody');
    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="icon">🔍</div><h3>Nenhum resultado</h3><p>Tente outros termos ou filtros.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = slice.map(r => {
            const disabled = isDisabled(r.id);
            const status   = getStatusForEstab(r);
            return `
        <tr>
          <td><div class="td-nome">${esc(r.nome_fantasia)}</div></td>
          <td><div class="td-razao">${esc(r.razao_social)}</div></td>
          <td><div class="td-end">${esc(r.endereco)}</div></td>
          <td><span class="badge badge-bairro">${esc(r.bairro)}</span></td>
          <td>${r.categoria ? '<span class="badge badge-cat">' + esc(r.categoria) + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
          <td>${riskBadge(r.classe_risco)}</td>
          <td>${statusBadge(status)}</td>
          <td>${licenciamentoBadge(r.licenciamento)}</td>
          <td>${activeBadge(disabled)}</td>
          <td><div class="td-actions">
            <button class="action-btn view"       onclick="openDetail(${r.id})" title="Ver detalhes">👁️</button>
            <button class="action-btn edit"       onclick="openEdit(${r.id})"   title="Editar">✏️</button>
            <button class="action-btn ${disabled ? 'activate' : 'deactivate'}"
              onclick="toggleEstab(${r.id})"
              title="${disabled ? 'Ativar estabelecimento' : 'Desativar estabelecimento'}">
              ${disabled ? '✅' : '🚫'}
            </button>
          </div></td>
        </tr>`;
        }).join('');
    }

    const from = total === 0 ? 0 : (currentEstabPage - 1) * PAGE_SIZE + 1;
    const to   = Math.min(currentEstabPage * PAGE_SIZE, total);
    document.getElementById('paginationInfo').textContent = `Mostrando ${from}–${to} de ${total}`;
    document.getElementById('paginationBtns').innerHTML   = buildPaginationHTML(currentEstabPage, totalPages, 'goPage');
}

function goPage(p) {
    const tp = Math.max(1, Math.ceil(filteredData().length / PAGE_SIZE));
    if (p < 1 || p > tp) return;
    currentEstabPage = p;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Tabela de Inativos ----------
function renderInativos() {
    const data  = filteredDataInativos();
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentInativosPage > totalPages) currentInativosPage = totalPages;
    const slice = data.slice((currentInativosPage - 1) * PAGE_SIZE, currentInativosPage * PAGE_SIZE);

    const countEl = document.getElementById('inativosCount');
    if (countEl) countEl.textContent = total + ' resultado' + (total !== 1 ? 's' : '');

    const tbody      = document.getElementById('inativosTableBody');
    const podeExcluir = getConfig().permitirExclusaoInativos === true;

    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="icon">🚫</div><h3>Nenhum estabelecimento inativo</h3><p>Todos os estabelecimentos estão ativos.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = slice.map(r => `<tr>
      <td><div class="td-nome">${esc(r.nome_fantasia)}</div></td>
      <td><div class="td-razao">${esc(r.razao_social)}</div></td>
      <td><div class="td-end">${esc(r.endereco)}</div></td>
      <td><span class="badge badge-bairro">${esc(r.bairro)}</span></td>
      <td>${r.categoria ? '<span class="badge badge-cat">' + esc(r.categoria) + '</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
      <td>${riskBadge(r.classe_risco)}</td>
      <td>${licenciamentoBadge(r.licenciamento)}</td>
      <td><span class="badge badge-inativo">🚫 Inativo</span></td>
      <td><div class="td-actions">
        <button class="action-btn view"     onclick="openDetail(${r.id})"  title="Ver detalhes">👁️</button>
        <button class="action-btn activate" onclick="toggleEstab(${r.id})" title="Ativar estabelecimento">✅</button>
        <button class="action-btn edit"     onclick="openEdit(${r.id})"    title="Editar">✏️</button>
        ${podeExcluir ? `<button class="action-btn del" onclick="requestPermanentDelete(${r.id})" title="Excluir permanentemente">🗑️</button>` : ''}
      </div></td>
    </tr>`).join('');
    }

    const from = total === 0 ? 0 : (currentInativosPage - 1) * PAGE_SIZE + 1;
    const to   = Math.min(currentInativosPage * PAGE_SIZE, total);
    const info = document.getElementById('inativosPaginationInfo');
    const btns = document.getElementById('inativosPaginationBtns');
    if (info) info.textContent = `Mostrando ${from}–${to} de ${total}`;
    if (btns) btns.innerHTML   = buildPaginationHTML(currentInativosPage, totalPages, 'goInativosPage');
}

function goInativosPage(p) {
    const tp = Math.max(1, Math.ceil(filteredDataInativos().length / PAGE_SIZE));
    if (p < 1 || p > tp) return;
    currentInativosPage = p;
    renderInativos();
}

// ---------- Detalhe ----------
function openDetail(id) {
    const r = DADOS.find(d => d.id === id);
    if (!r) return;
    const st = getStatusForEstab(r);
    document.getElementById('detailNome').textContent = r.nome_fantasia;
    document.getElementById('detailBadges').innerHTML =
        `<span class="badge badge-bairro">${esc(r.bairro)}</span>
         ${r.categoria ? '<span class="badge badge-cat">' + esc(r.categoria) + '</span>' : ''}
         ${riskBadge(r.classe_risco)}${statusBadge(st)}${licenciamentoBadge(r.licenciamento)}`;
    document.getElementById('detailInfo').innerHTML =
        `<div class="info-item"><label>Razão social/ proprietário</label><p>${esc(r.razao_social) || '—'}</p></div>
         <div class="info-item"><label>CPF/CNPJ</label><p>${esc(r.cpf_cnpj) || '—'}</p></div>
         <div class="info-item"><label>Endereço</label><p>${esc(r.endereco) || '—'}</p></div>
         <div class="info-item"><label>Tipo de Atividade</label><p>${esc(r.tipo_atividade) || '—'}</p></div>
         <div class="info-item"><label>Última Fiscalização</label><p>${formatDate(r.ultimo_fiscalização)}</p></div>
         <div class="info-item"><label>Órgão Licenciador</label><p>${esc(r.orgao_licenciador) || '—'}</p></div>
         <div class="info-item"><label>CNAE</label><p>${esc(r.cnae) || '—'}</p></div>
         <div class="info-item"><label>Licenciamento</label><p>${esc(r.licenciamento) || '—'}</p></div>
         ${r.fiscalizacao_descricao ? `<div class="info-item full"><label>Descrição da Fiscalização</label><p style="white-space:pre-wrap">${esc(r.fiscalizacao_descricao)}</p></div>` : ''}`;
    openModal('modalDetail');
}

// ---------- Ativar / Desativar (com log) ----------
let _pendingDeactivateId = null;
let _pendingActivateId   = null;

function toggleEstab(id) {
    const disabled = isDisabled(id);
    const r = DADOS.find(d => d.id === id);
    if (disabled) {
        _pendingActivateId = id;
        document.getElementById('activateNomeLabel').textContent = r ? r.nome_fantasia : 'ID ' + id;
        openModal('modalConfirmActivate');
    } else {
        _pendingDeactivateId = id;
        document.getElementById('delNomeLabel').textContent = r ? r.nome_fantasia : 'ID ' + id;
        openModal('modalConfirmDel');
    }
}

function confirmActivate() {
    const id = _pendingActivateId;
    if (id === null) return;
    const r = DADOS.find(d => d.id === id);
    const list = getDisabledIds();
    const idx  = list.map(String).indexOf(String(id));
    if (idx >= 0) list.splice(idx, 1);
    saveDisabledIds(list);
    saveInativosData(getInativosData().filter(x => String(x.id) !== String(id)));
    closeModal('modalConfirmActivate');
    if (r) {
        registrarLog('estabelecimento', 'ativado', 'Estabelecimento', r.nome_fantasia || 'ID ' + id,
            'Estabelecimento "' + r.nome_fantasia + '" foi reativado.');
    }
    showToast('Estabelecimento ativado! ✅', 'success');
    _pendingActivateId = null;
    refreshAfterChange();
    renderPainelRegistro();
}

async function confirmDeactivate() {
    if (_pendingDeactivateId === null) return;
    const id = _pendingDeactivateId;
    const r  = DADOS.find(d => d.id === id);
    if (r) {
        const lista = getInativosData();
        if (!lista.some(x => String(x.id) === String(id))) {
            lista.push({ ...r, desativadoEm: new Date().toISOString() });
            await saveInativosData(lista);
        }
    }
    const list = getDisabledIds();
    list.push(id);
    saveDisabledIds(list);
    closeModal('modalConfirmDel');
    if (r) {
        registrarLog('estabelecimento', 'desativado', 'Estabelecimento', r.nome_fantasia || 'ID ' + id,
            'Estabelecimento "' + r.nome_fantasia + '" foi desativado e movido para inativos.');
    }
    showToast((r ? r.nome_fantasia : 'Estabelecimento') + ' desativado.', 'success');
    _pendingDeactivateId = null;
    refreshAfterChange();
    renderPainelRegistro();
}

// ---------- Exclusão Permanente (com log) ----------
let _pendingPermanentDeleteId = null;

function requestPermanentDelete(id) {
    const r = DADOS.find(d => d.id === id);
    if (!r) return;
    _pendingPermanentDeleteId = id;
    document.getElementById('permanentDeleteNomeLabel').textContent = r.nome_fantasia;
    openModal('modalConfirmPermanentDelete');
}

async function confirmPermanentDelete() {
    const id = _pendingPermanentDeleteId;
    if (id === null) return;
    const r = DADOS.find(d => d.id === id);
    _pendingPermanentDeleteId = null;
    closeModal('modalConfirmPermanentDelete');
    try {
        saveCustom(getCustom().filter(c => String(c.id) !== String(id)));
        const edited = getEditedMap();
        delete edited[String(id)];
        saveEditedMap(edited);
        saveDisabledIds(getDisabledIds().filter(d => String(d) !== String(id)));
        await saveInativosData(getInativosData().filter(x => String(x.id) !== String(id)));
        _DADOS_ORIGINAL = _DADOS_ORIGINAL.filter(r => String(r.id) !== String(id));
        rebuildDADOS();
        if (r) {
            registrarLog('estabelecimento', 'excluido', 'Estabelecimento', r.nome_fantasia || 'ID ' + id,
                'Estabelecimento "' + r.nome_fantasia + '" foi excluído permanentemente do sistema.');
        }
        showToast('Estabelecimento excluído permanentemente.', 'success');
        refreshAfterChange();
        renderPainelRegistro();
    } catch (e) {
        showToast('Erro ao excluir: ' + e.message, 'error');
    }
}

// ---------- Formulário Adicionar/Editar (com log) ----------
let currentEditId = null;

function openAdd() {
    currentEditId = null;
    document.getElementById('estabModalTitle').textContent = '＋ Novo Estabelecimento';
    document.getElementById('estabModalSub').textContent   = 'Preencha os dados do novo estabelecimento';
    clearEstabForm();
    document.getElementById('estCpfCnpj')?.classList.remove('valid', 'invalid');
    updateCpfLabel();
    openModal('modalEstab');
}

function openEdit(id) {
    const r = DADOS.find(d => d.id === id);
    if (!r) return;
    currentEditId = id;
    document.getElementById('estabModalTitle').textContent = '✏️ Editar Estabelecimento';
    document.getElementById('estabModalSub').textContent   = r.nome_fantasia;
    document.getElementById('estNome').value          = r.nome_fantasia || '';
    document.getElementById('estRazao').value         = r.razao_social  || '';
    document.getElementById('estCpfCnpj').value       = r.cpf_cnpj      || '';
    document.getElementById('estLicenciamento').value = r.licenciamento  || '';
    document.getElementById('estEndereco').value      = r.endereco       || '';
    document.getElementById('estBairro').value        = r.bairro         || '';
    document.getElementById('estCategoria').value     = r.categoria      || '';
    document.getElementById('estAtividade').value     = r.tipo_atividade || '';
    document.getElementById('estCnae').value          = r.cnae           || '';
    document.getElementById('estRisco').value         = r.classe_risco   || '';
    document.getElementById('estLicenca').value       = r.ultimo_fiscalização?.slice(0, 10) || '';
    document.getElementById('estOrgao').value         = 'VISA/CAREIRO';
    document.getElementById('estFiscDescricao').value = r.fiscalizacao_descricao || '';

    const cpfEl = document.getElementById('estCpfCnpj');
    if (cpfEl && r.cpf_cnpj) { cpfEl.dispatchEvent(new Event('input')); }
    else if (cpfEl) { cpfEl.classList.remove('valid', 'invalid'); }

    updateCpfLabel();
    openModal('modalEstab');
}

function clearEstabForm() {
    ['estNome', 'estRazao', 'estCpfCnpj', 'estEndereco', 'estCategoria', 'estAtividade', 'estCnae', 'estLicenca', 'estOrgao', 'estFiscDescricao']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('estBairro').value        = '';
    document.getElementById('estRisco').value         = '';
    document.getElementById('estLicenciamento').value = '';
    document.getElementById('estCpfCnpj')?.classList.remove('valid', 'invalid');
}

function saveEstab() {
    const nome          = document.getElementById('estNome').value.trim();
    const razao         = document.getElementById('estRazao').value.trim();
    const cpfCnpj       = document.getElementById('estCpfCnpj').value.trim();
    const licenciamento = document.getElementById('estLicenciamento').value;
    const endereco      = document.getElementById('estEndereco').value.trim();
    const bairro        = document.getElementById('estBairro').value;
    const categoria     = document.getElementById('estCategoria').value.trim();
    const atividade     = document.getElementById('estAtividade').value.trim();
    const cnae          = document.getElementById('estCnae').value.trim();
    const risco         = document.getElementById('estRisco').value;
    const licenca       = document.getElementById('estLicenca').value;
    const fiscDescricao = document.getElementById('estFiscDescricao').value.trim();

    // Validações
    if (!nome)          { showToast('Informe o Nome Fantasia!', 'error'); return; }
    if (!razao)         { showToast('Informe a Razão social/ proprietário!', 'error'); return; }

    const cpfObrigatorio = getConfig().cpfObrigatorio !== false;
    if (cpfObrigatorio) {
        if (!cpfCnpj) { showToast('Informe o CPF/CNPJ!', 'error'); return; }
        const limpo = cpfCnpj.replace(/\D/g, '');
        if (limpo.length !== 11 && limpo.length !== 14) { showToast('CPF deve ter 11 dígitos ou CNPJ 14 dígitos!', 'error'); return; }
        if (limpo.length === 11 && !validarCPF(limpo))  { showToast('CPF inválido! Verifique os dígitos.', 'error'); return; }
        if (limpo.length === 14 && !validarCNPJ(limpo)) { showToast('CNPJ inválido! Verifique os dígitos.', 'error'); return; }
    }

    if (!licenciamento) { showToast('Selecione o Licenciamento!', 'error'); return; }
    if (!endereco)      { showToast('Informe o Endereço!', 'error'); return; }
    if (!bairro)        { showToast('Selecione a Localidade!', 'error'); return; }
    if (!categoria)     { showToast('Informe a Categoria!', 'error'); return; }
    if (!atividade)     { showToast('Informe o Tipo de Atividade!', 'error'); return; }
    if (!cnae)          { showToast('Informe o CNAE!', 'error'); return; }
    if (!risco)         { showToast('Selecione a Classe de Risco!', 'error'); return; }
    if (!licenca)       { showToast('Informe o Última Fiscalização!', 'error'); return; }

    const payload = {
        nome_fantasia:       nome,
        razao_social:        razao,
        cpf_cnpj:            cpfCnpj,
        licenciamento,
        endereco,
        bairro,
        categoria:           categoria.toUpperCase(),
        tipo_atividade:      atividade.toUpperCase(),
        cnae,
        classe_risco:        risco,
        ultimo_fiscalização: licenca,
        orgao_licenciador:   'VISA/CAREIRO',
        fiscalizacao_descricao: fiscDescricao
    };

    let acao = 'criado';
    let nomeEntidade = nome;

    if (currentEditId !== null) {
        // Edição
        const custom      = getCustom();
        const customIndex = custom.findIndex(c => String(c.id) === String(currentEditId));
        const edited      = getEditedMap();

        if (customIndex !== -1) {
            const antigo = custom[customIndex];
            custom[customIndex] = { ...custom[customIndex], ...payload };
            saveCustom(custom);
            if (edited[String(currentEditId)]) { delete edited[String(currentEditId)]; saveEditedMap(edited); }
        } else {
            edited[String(currentEditId)] = { ...edited[String(currentEditId)], ...payload };
            saveEditedMap(edited);
        }
        acao = 'atualizado';
        showToast('Estabelecimento atualizado! ✅', 'success');
        registrarLog('estabelecimento', 'atualizado', 'Estabelecimento', nomeEntidade,
            'Informações do estabelecimento "' + nomeEntidade + '" foram atualizadas.');
    } else {
        // Novo
        const custom = getCustom();
        const novoId = Date.now();
        custom.push({ id: novoId, ...payload });
        saveCustom(custom);
        showToast('Estabelecimento adicionado! ✅', 'success');
        registrarLog('estabelecimento', 'criado', 'Estabelecimento', nomeEntidade,
            'Novo estabelecimento "' + nomeEntidade + '" cadastrado no sistema.');
    }

    rebuildDADOS();
    closeModal('modalEstab');
    refreshAllCategoryDropdowns();
    refreshAfterChange();
    renderPainelRegistro();
}

// ---------- Dropdowns auxiliares ----------
function refreshAllCategoryDropdowns() {
    const cats  = [...new Set(DADOS.map(r => r.categoria).filter(Boolean))].sort();
    const catSel = document.getElementById('filterCategoria');
    if (!catSel) return;
    const curVal = catSel.value;
    catSel.innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    catSel.value = curVal;
}

function initCatDatalist() {
    const cats = [...new Set(DADOS.map(r => r.categoria).filter(Boolean))].sort();
    const dl   = document.getElementById('catList');
    if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

function refreshAllBairroDropdowns() {
    const bairros = getBairros().slice().sort((a, b) => a.localeCompare(b));
    const opts    = bairros.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    const fb = document.getElementById('filterBairro');
    if (fb) { const cur = fb.value; fb.innerHTML = '<option value="">Todas as localidades</option>' + opts; if (cur) fb.value = cur; }
    const eb = document.getElementById('estBairro');
    if (eb) { const cur = eb.value; eb.innerHTML = '<option value="">Selecionar...</option>' + opts; if (cur) eb.value = cur; }
}

function updateTopBadges() {
    const active = DADOS.filter(r => !isDisabled(r.id));
    let fiscalizados = 0;
    active.forEach(r => { if (getStatusForEstab(r) === 'fiscalizado') fiscalizados++; });
    document.getElementById('badgeTotal').textContent       = active.length;
    document.getElementById('badgeFiscalizado').textContent = fiscalizados;
}

function updateCpfLabel() {
    const label = document.getElementById('cpfLabelObrigatorio');
    if (label) label.textContent = getConfig().cpfObrigatorio !== false ? '*' : '';
}

function refreshAfterChange() {
    updateTopBadges();
    if (currentPage === 'estabelecimentos') { renderTable(); updateCpfLabel(); }
    if (currentPage === 'inativos')         renderInativos();
    if (currentPage === 'dashboard')        renderDashboard();
    if (currentPage === 'cronograma')       renderCronograma();
    if (currentPage === 'legislacao')       renderLegislacao();
    if (currentPage === 'configuracoes')    { renderConfig(); updateCpfLabel(); }
}

// ---------- Validação CPF / CNPJ ----------
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.charAt(i - 1)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.charAt(i - 1)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.charAt(10));
}

function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let tam = cnpj.length - 2;
    let num = cnpj.substring(0, tam);
    const dig = cnpj.substring(tam);
    let soma = 0, pos = tam - 7;
    for (let i = tam; i >= 1; i--) { soma += num.charAt(tam - i) * pos--; if (pos < 2) pos = 9; }
    let res = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (res != dig.charAt(0)) return false;
    tam += 1;
    num  = cnpj.substring(0, tam);
    soma = 0; pos = tam - 7;
    for (let i = tam; i >= 1; i--) { soma += num.charAt(tam - i) * pos--; if (pos < 2) pos = 9; }
    res = soma % 11 < 2 ? 0 : 11 - soma % 11;
    return res == dig.charAt(1);
}

function validarCpfCnpjVisual(inputEl) {
    const valor = inputEl.value.trim();
    if (!valor) { inputEl.classList.remove('valid', 'invalid'); return; }
    const limpo = valor.replace(/\D/g, '');
    if      (limpo.length === 11) { inputEl.classList.toggle('valid', validarCPF(limpo));  inputEl.classList.toggle('invalid', !validarCPF(limpo)); }
    else if (limpo.length === 14) { inputEl.classList.toggle('valid', validarCNPJ(limpo)); inputEl.classList.toggle('invalid', !validarCNPJ(limpo)); }
    else if (limpo.length > 0)    { inputEl.classList.add('invalid'); inputEl.classList.remove('valid'); }
    else                          { inputEl.classList.remove('valid', 'invalid'); }
}