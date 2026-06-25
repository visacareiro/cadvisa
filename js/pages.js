/* ============================================================
   VISA Careiro — Dashboard, Impressão, Cronograma,
                  Legislação, Configurações e LOG DE AUDITORIA
   ============================================================ */

// ============================================================
// UTILITÁRIO DE IMPRESSÃO DIRETA
// ============================================================

function imprimirHTML(html) {
    const win = window.open('', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,scrollbars=yes');
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>CADVISA</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <style>${_printStyles()}</style>
</head>
<body>
    <div>${html}</div>
    <script>
        window.onload = function() {
            window.print();
            window.onfocus = function() { window.close(); };
        };
    <\/script>
</body>
</html>`);
    win.document.close();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
    const activeData  = DADOS.filter(r => !isDisabled(r.id));
    const inativoCount = DADOS.filter(r => isDisabled(r.id)).length;
    let fiscalizados = 0, pendentes = 0;
    activeData.forEach(r => { if (getStatusForEstab(r) === 'fiscalizado') fiscalizados++; else pendentes++; });

    document.getElementById('statFiscalizado').textContent = fiscalizados;
    document.getElementById('statPendente').textContent    = pendentes;
    document.getElementById('statInativos').textContent    = inativoCount;
    document.getElementById('statTotalAtivos').textContent = fiscalizados + pendentes;
    updateTopBadges();

    function groupDiversos(entries, limit = 21) {
        if (entries.length <= limit) return entries;
        const top  = entries.slice(0, limit - 1);
        const rest = entries.slice(limit - 1);
        return [...top, ['Diversos', rest.reduce((s, [, c]) => s + c, 0)]];
    }

    const bairros = {};
    activeData.forEach(r => { const k = r.bairro || 'Não informado'; bairros[k] = (bairros[k] || 0) + 1; });
    let bEntries = groupDiversos(Object.entries(bairros).sort((a, b) => b[1] - a[1]));
    const bMax = Math.max(1, ...bEntries.map(([, c]) => c));
    document.getElementById('bairroChart').innerHTML = bEntries.map(([name, cnt]) =>
        `<div class="bar-item">
           <div class="bar-label"><span>${esc(name)}</span><span>${cnt}</span></div>
           <div class="bar-track"><div class="bar-fill" style="width:${(cnt / bMax * 100).toFixed(1)}%"></div></div>
         </div>`
    ).join('');

    const riscos  = { 'BAIXO RISCO': 0, 'ALTO RISCO': 0, 'Não informado': 0 };
    activeData.forEach(r => {
        if      (r.classe_risco === 'BAIXO RISCO') riscos['BAIXO RISCO']++;
        else if (r.classe_risco === 'ALTO RISCO')  riscos['ALTO RISCO']++;
        else                                        riscos['Não informado']++;
    });
    const rColors = { 'BAIXO RISCO': '#6bcb8b', 'ALTO RISCO': '#e05a6b', 'Não informado': '#ddc5cc' };
    document.getElementById('riscoChart').innerHTML = Object.entries(riscos).map(([name, cnt]) =>
        `<div class="pie-row">
           <div class="pie-dot" style="background:${rColors[name]}"></div>
           <div class="pie-name">${name}</div>
           <div class="pie-val">${cnt}</div>
         </div>`
    ).join('');

    const cats = {};
    activeData.forEach(r => {
        const cat = (r.categoria && r.categoria.trim()) ? r.categoria.trim().toUpperCase() : 'NÃO INFORMADO';
        cats[cat] = (cats[cat] || 0) + 1;
    });
    let allCats = groupDiversos(Object.entries(cats).sort((a, b) => b[1] - a[1]));
    const cMax  = allCats.length ? allCats[0][1] : 1;
    document.getElementById('catChart').innerHTML = allCats.length
        ? allCats.map(([name, cnt]) =>
            `<div class="bar-item">
               <div class="bar-label"><span style="font-size:12px">${esc(name)}</span><span>${cnt}</span></div>
               <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt / cMax * 100)}%"></div></div>
             </div>`)
            .join('')
        : '<div style="color:var(--text-muted);font-size:13px;padding:10px">Nenhuma categoria cadastrada.</div>';

    // Painel de registro (auditoria)
    renderPainelRegistro();
}

// ============================================================
// PAINEL DE REGISTRO DE ATIVIDADES (sem IP)
// ============================================================

let filtroMesAudit = null;
let filtroTipoAudit = 'todos';

function renderPainelRegistro() {
    const container = document.getElementById('painelRegistroContainer');
    if (!container) return;

    const agora = new Date();
    const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
    const anoAtual = agora.getFullYear();
    const mesCorrente = anoAtual + '-' + mesAtual;

    if (!filtroMesAudit) filtroMesAudit = mesCorrente;

    const mesesDisponiveis = obterMesesDisponiveis();
    const selectHtml = mesesDisponiveis.map(m => {
        const label = m + ' (' + obterNomeMes(parseInt(m.split('-')[1])) + '/' + m.split('-')[0] + ')';
        return `<option value="${m}" ${m === filtroMesAudit ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const stats = getAuditStats(filtroMesAudit);
    const logsFiltrados = getAuditLogsFiltrados(filtroTipoAudit, filtroMesAudit);

    const logsOrdenados = [...logsFiltrados].sort((a, b) => b.id - a.id);

    // Gera HTML para a lista de logs (agora com nome do usuário em vez de IP)
    const logsHtml = logsOrdenados.slice(0, 100).map(log => {
        const iconeTipo = log.type === 'cronograma' ? '📅' :
                          log.type === 'estabelecimento' ? '🏪' :
                          log.type === 'configuracao' ? '⚙️' : '📋';
        const acaoLabel = log.action;
        const badgeAcao = `<span style="display:inline-block;padding:1px 8px;border-radius:50px;font-size:10px;font-weight:700;background:rgba(244,138,171,0.2);color:var(--text-light);">${acaoLabel}</span>`;
        const nomeExibicao = log.entityName || log.entity;
        const userExibicao = log.usuario || log.user || 'Sistema';
        return `<div class="audit-log-item" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);font-size:12px;transition:background 0.15s;">
            <div style="font-size:18px;flex-shrink:0;width:28px;text-align:center;margin-top:2px;">${iconeTipo}</div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
                    <span style="font-weight:600;color:var(--text);">${esc(nomeExibicao)}</span>
                    ${badgeAcao}
                    <span style="font-size:10px;color:var(--text-muted);">por <strong>${esc(userExibicao)}</strong></span>
                </div>
                ${log.details ? `<div style="font-size:11px;color:var(--text-light);margin-top:3px;">${esc(log.details)}</div>` : ''}
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${log.date || '—'} ${log.hora || ''}</div>
            </div>
            <div style="flex-shrink:0;font-size:10px;color:var(--text-muted);">#${log.id}</div>
        </div>`;
    }).join('');

    const totalLogs = logsOrdenados.length;
    const resumoHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 16px;">
            <div class="audit-stat" style="background:rgba(244,138,171,0.12);border-radius:8px;padding:8px 12px;text-align:center;">
                <div style="font-size:20px;font-weight:900;color:var(--rosa-dark);">${stats.total}</div>
                <div style="font-size:10px;color:var(--text-muted);">Total</div>
            </div>
            <div class="audit-stat" style="background:rgba(244,138,171,0.08);border-radius:8px;padding:8px 12px;text-align:center;">
                <div style="font-size:20px;font-weight:900;color:var(--rosa-dark);">${stats.cronograma}</div>
                <div style="font-size:10px;color:var(--text-muted);">📅 Cronograma</div>
            </div>
            <div class="audit-stat" style="background:rgba(246,195,65,0.12);border-radius:8px;padding:8px 12px;text-align:center;">
                <div style="font-size:20px;font-weight:900;color:var(--amarelo-dark);">${stats.estabelecimento}</div>
                <div style="font-size:10px;color:var(--text-muted);">🏪 Estabelecimentos</div>
            </div>
            <div class="audit-stat" style="background:rgba(107,203,139,0.12);border-radius:8px;padding:8px 12px;text-align:center;">
                <div style="font-size:20px;font-weight:900;color:var(--success);">${stats.configuracao}</div>
                <div style="font-size:10px;color:var(--text-muted);">⚙️ Configurações</div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div style="margin-top:28px;background:rgba(255,255,255,0.62);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1.5px solid rgba(255,255,255,0.55);border-radius:var(--radius);padding:20px;box-shadow:0 4px 28px rgba(244,138,171,0.10),inset 0 1px 0 rgba(255,255,255,0.8);">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
                <h3 style="font-family:'Playfair Display',serif;font-size:16px;">📋 Painel de Registro de Atividades</h3>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <select id="filtroMesAudit" onchange="aplicarFiltroAudit()" style="padding:6px 10px;border-radius:50px;border:1.5px solid var(--border-solid);font-size:12px;background:rgba(255,255,255,0.7);">
                        ${selectHtml}
                    </select>
                    <select id="filtroTipoAudit" onchange="aplicarFiltroAudit()" style="padding:6px 10px;border-radius:50px;border:1.5px solid var(--border-solid);font-size:12px;background:rgba(255,255,255,0.7);">
                        <option value="todos" ${filtroTipoAudit === 'todos' ? 'selected' : ''}>Todos</option>
                        <option value="cronograma" ${filtroTipoAudit === 'cronograma' ? 'selected' : ''}>📅 Cronograma</option>
                        <option value="estabelecimento" ${filtroTipoAudit === 'estabelecimento' ? 'selected' : ''}>🏪 Estabelecimentos</option>
                        <option value="configuracao" ${filtroTipoAudit === 'configuracao' ? 'selected' : ''}>⚙️ Configurações</option>
                    </select>
                    <button onclick="aplicarFiltroAudit()" style="padding:6px 14px;border-radius:50px;border:none;background:var(--rosa-dark);color:#fff;font-weight:600;font-size:12px;cursor:pointer;">Atualizar</button>
                </div>
            </div>

            ${resumoHtml}

            <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 10px;">
                <span style="font-size:12px;font-weight:600;color:var(--text-muted);">📋 Últimos registros (${totalLogs} no total)</span>
                <span style="font-size:10px;color:var(--text-muted);">exibindo até 100 registros</span>
            </div>

            <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.5);">
                ${logsHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted);">Nenhum registro encontrado para este período.</div>'}
            </div>
        </div>
    `;
}

function obterMesesDisponiveis() {
    const logs = getAuditLogs();
    const meses = new Set();
    logs.forEach(log => {
        if (log.month) meses.add(log.month);
    });
    if (meses.size === 0) {
        const agora = new Date();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        meses.add(agora.getFullYear() + '-' + mes);
    }
    return Array.from(meses).sort().reverse();
}

function obterNomeMes(num) {
    const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return nomes[num - 1] || num;
}

function aplicarFiltroAudit() {
    const mesSelect = document.getElementById('filtroMesAudit');
    const tipoSelect = document.getElementById('filtroTipoAudit');
    if (mesSelect) filtroMesAudit = mesSelect.value;
    if (tipoSelect) filtroTipoAudit = tipoSelect.value;
    renderPainelRegistro();
}

// ============================================================
// IMPRESSÃO — Estabelecimentos (rodapé apenas na última página, cabeçalho da tabela em negrito maior)
// ============================================================
function imprimirEstabelecimentos() {
    const data = filteredData();
    if (!data.length) { showToast('Nenhum estabelecimento para imprimir!', 'error'); return; }

    const rows = data.map((r, i) => {
        const st    = getStatusForEstab(r);
        const stTxt = st === 'fiscalizado' ? 'Fiscalizado' : 'Pendente';
        const stColor = st === 'fiscalizado' ? '#2a6e47' : '#7a4e00';
        const stBg    = st === 'fiscalizado' ? '#e8f8ee' : '#fff4e0';
        return `<tr>
          <td style="text-align:center;font-weight:600;border:1px solid #000;">${i + 1}</td>
          <td style="font-weight:600;border:1px solid #000;">${esc(r.nome_fantasia)}</td>
          <td style="font-size:11px;color:#555;border:1px solid #000;">${esc(r.razao_social) || '&mdash;'}</td>
          <td style="font-size:11px;color:#555;border:1px solid #000;">${esc(r.cpf_cnpj) || '&mdash;'}</td>
          <td style="font-size:11px;color:#555;max-width:120px;border:1px solid #000;">${esc(r.endereco) || '&mdash;'}</td>
          <td style="border:1px solid #000;">${esc(r.bairro) || '&mdash;'}</td>
          <td style="font-size:11px;border:1px solid #000;">${esc(r.categoria) || '&mdash;'}</td>
          <td style="font-size:10px;color:#555;max-width:110px;border:1px solid #000;">${esc(r.tipo_atividade) || '&mdash;'}</td>
          <td style="font-size:10px;border:1px solid #000;">${esc(r.cnae) || '&mdash;'}</td>
          <td style="font-size:11px;border:1px solid #000;">${r.classe_risco?.includes('BAIXO') ? 'Baixo' : r.classe_risco?.includes('ALTO') ? 'Alto' : '&mdash;'}</td>
          <td style="font-size:10px;color:#555;border:1px solid #000;">${esc(r.orgao_licenciador) || '&mdash;'}</td>
          <td style="font-size:11px;border:1px solid #000;">${r.ultimo_fiscalização ? formatDate(r.ultimo_fiscalização) : '&mdash;'}</td>
          <td style="font-size:10px;border:1px solid #000;">${esc(r.licenciamento) || '&mdash;'}</td>
          <td style="border:1px solid #000;"><span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:${stBg};color:${stColor}">${stTxt}</span></td>
        </tr>`;
    }).join('');

    const html = `
        <div style="display:flex; flex-direction:column; min-height:100vh; padding:8px 12px; font-family:'DM Sans',sans-serif; box-sizing:border-box;">
            <!-- Cabeçalho com logos e título centralizado -->
            <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #f48aab; padding-bottom:8px; margin-bottom:12px;">
                <div style="flex:0 0 auto;">
                    <img src="assets/semsa.jpg" alt="SEMSA" style="height:40px; width:auto;">
                </div>
                <div style="flex:1; text-align:center;">
                    <div style="font-family:'Playfair Display',serif; font-size:22px; font-weight:bold; color:#1a1a2e; margin:0;">Controle de dados de estabelecimento</div>
                    <div style="font-size:14px; color:#555; margin-top:2px;">Visa - Vigilância Sanitária de Careiro</div>
                </div>
                <div style="flex:0 0 auto;">
                    <img src="assets/prefcareiro.jpg" alt="Prefeitura" style="height:40px; width:auto;">
                </div>
            </div>

            <!-- Tabela de dados com bordas pretas -->
            <div style="flex:1;">
                <table style="width:100%; border-collapse:collapse; font-size:8px;">
                    <thead>
                        <tr style="background:#f48aab; color:white;">
                            <th style="width:28px; padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">#</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Nome Fantasia</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Razão social/ proprietário</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">CPF/CNPJ</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Endereço</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Localidade</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Categoria</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Tipo Atividade</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">CNAE</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Risco</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Órgão Lic.</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Fiscalização</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Licenciamento</th>
                            <th style="padding:4px 5px; text-align:center; font-weight:bold; font-size:9px; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; border:1px solid #000;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Rodapé — aparece apenas na última página, pois está no fluxo normal -->
            <div style="border-top:2px solid #f48aab; padding:8px 0; margin-top:16px; display:flex; justify-content:space-between; align-items:center; font-size:8px; color:#555; page-break-inside:avoid;">
                <div>
                    Av. Mário Jorge Guedes, nº 391, Centro – Careiro<br>
                    Sede da Prefeitura – CEP: 69250-000<br>
                    e-mail: sms-careiro@saude.am.gov.br
                </div>
                <div style="flex:0 0 auto;">
                    <img src="assets/timbre.jpg" alt="Timbre" style="height:40px; width:auto;">
                </div>
            </div>
        </div>
    `;

    imprimirHTML(html);
}

// ============================================================
// CRONOGRAMA (IMPRESSÃO MELHORADA COM LAYOUT SEMANAL)
// ============================================================
const COLOR_SEQUENCE = [null, 'red', 'green', 'blue'];
const COLOR_HEX2     = { red: '#e05a6b', green: '#6bcb8b', blue: '#3a7dc9' };
const COLOR_BG2      = { red: 'rgba(224,90,107,0.13)', green: 'rgba(107,203,139,0.13)', blue: 'rgba(58,125,201,0.13)' };

function getDiasNoMes(mes, ano) { return new Date(ano, mes, 0).getDate(); }

function alternarCorTopico(btn) {
    const current = btn.dataset.color || '';
    const idx     = COLOR_SEQUENCE.indexOf(current === '' ? null : current);
    const next    = COLOR_SEQUENCE[(idx + 1) % COLOR_SEQUENCE.length];
    const newColor = next || '';

    btn.dataset.color = newColor;
    btn.title = next ? 'Cor: ' + next : 'Sem cor';
    if (next) {
        btn.style.background    = COLOR_HEX2[next];
        btn.style.borderColor   = COLOR_HEX2[next];
        btn.style.borderStyle   = '';
        btn.classList.remove('no-color');
    } else {
        btn.style.background    = '#fff';
        btn.style.borderColor   = '#ddd';
        btn.style.borderStyle   = 'dashed';
        btn.classList.add('no-color');
    }

    const container = btn.closest('.topico-row');
    if (container) {
        const input = container.querySelector('.cronograma-topico');
        if (input) {
            input.dataset.color = newColor;
            input.style.background  = next ? COLOR_BG2[next] : '';
            input.style.borderLeft  = next ? `3px solid ${COLOR_HEX2[next]}` : '';
        }
    }
}

function renderCronograma() {
    const mesSel = document.getElementById('cronogramaMes');
    const anoSel = document.getElementById('cronogramaAno');
    if (!mesSel || !anoSel) return;

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;

    if (!anoSel.options.length) {
        for (let a = anoAtual - 1; a <= anoAtual + 2; a++) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            if (a === anoAtual) opt.selected = true;
            anoSel.appendChild(opt);
        }
        mesSel.value = mesAtual;
    }

    const mes = parseInt(mesSel.value);
    const ano = parseInt(anoSel.value);
    const totalDias  = getDiasNoMes(mes, ano);
    const cronograma = getCronogramaData();

    const mapa = {};
    cronograma.filter(r => r.mes === mes && r.ano === ano).forEach(r => {
        mapa[r.dia] = {
            ...r,
            topicos: (r.topicos || []).map(t => typeof t === 'string' ? { t, c: null } : t)
        };
    });

    const isPast    = (ano < anoAtual) || (ano === anoAtual && mes < mesAtual);

    const btnSalvar  = document.getElementById('btnSalvarCronograma');
    const statusMsg  = document.getElementById('cronoStatusMsg');
    if (btnSalvar) btnSalvar.disabled = isPast;
    if (statusMsg) statusMsg.textContent = isPast ? '⛔ Mês encerrado – somente leitura' : 'Edite os campos e clique em Salvar';

    const disabledAttr = isPast ? 'disabled' : '';
    const diasSemana   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let html = '';
    for (let dia = 1; dia <= totalDias; dia++) {
        const data     = new Date(ano, mes - 1, dia);
        const diaSem   = diasSemana[data.getDay()];
        const isToday  = (dia === agora.getDate() && mes === mesAtual && ano === anoAtual);
        const reg      = mapa[dia] || { topicos: [] };
        const topicos  = reg.topicos.length ? [...reg.topicos] : [{ t: '', c: null }];

        if (!topicos.length) topicos.push({ t: '', c: null });

        let topicosHtml = '';
        topicos.forEach((topico, idx) => {
            const isFirst = idx === 0;
            const valor = topico.t;
            const cor   = topico.c || '';
            const corHex      = COLOR_HEX2[cor] || '';
            const btnColorStyle = cor ? `background:${corHex};border-color:${corHex};` : 'background:#fff;border-style:dashed;';
            const inputStyle    = cor ? `background:${COLOR_BG2[cor]};border-left:3px solid ${corHex};` : '';

            const colorBtn = `<button type="button" class="btn-color-topico${cor ? '' : ' no-color'}"
                                     data-dia="${dia}" data-index="${idx}" data-color="${cor}"
                                     style="${btnColorStyle}" onclick="alternarCorTopico(this)"
                                     title="${cor ? 'Cor: ' + cor : 'Sem cor'}" ${disabledAttr}></button>`;
            const addBtn = `<button type="button" class="btn btn-sm btn-ghost cronograma-add-topico" 
                                     data-dia="${dia}" data-index="${idx}"
                                     style="padding:2px 8px;font-size:14px;line-height:1"
                                     onclick="addTopico(this, ${dia}, ${idx})" ${disabledAttr}>+</button>`;
            const removeBtn = !isFirst ? `<button type="button" class="btn btn-sm btn-ghost cronograma-remove-topico"
                                               data-dia="${dia}" data-index="${idx}"
                                               style="padding:2px 8px;font-size:14px;line-height:1;color:var(--danger)"
                                               onclick="removeTopico(this, ${dia}, ${idx})" ${disabledAttr}>×</button>` : '';

            topicosHtml += `
                <div class="topico-row" style="display:flex;gap:8px;margin-bottom:4px;align-items:center">
                    <input class="cronograma-editable cronograma-topico" type="text"
                        placeholder="Descreva o tópico..." value="${esc(valor)}"
                        data-dia="${dia}" data-index="${idx}" data-color="${cor}"
                        ${disabledAttr} style="${inputStyle}">
                    ${colorBtn}
                    ${addBtn}
                    ${removeBtn}
                </div>`;
        });

        html += `<tr class="${isToday ? 'today-row' : ''}">
            <td class="cronograma-dia">${String(dia).padStart(2, '0')} <span style="font-size:11px;color:var(--text-muted)">${diaSem}</span></td>
            <td class="cronograma-topicos-cell" data-dia="${dia}">${topicosHtml}</td>
        </tr>`;
    }
    document.getElementById('cronogramaTableBody').innerHTML = html;
}

function addTopico(btn, dia, index) {
    const cell = btn.closest('.cronograma-topicos-cell');
    const topicoDivs = cell.querySelectorAll('.topico-row');
    const refDiv = topicoDivs[index];
    if (!refDiv) return;

    const newDiv = document.createElement('div');
    newDiv.className = 'topico-row';
    newDiv.style.cssText = 'display:flex;gap:8px;margin-bottom:4px;align-items:center';
    const newIndex = index + 1;
    newDiv.innerHTML = `
        <input class="cronograma-editable cronograma-topico" type="text"
            placeholder="Descreva o tópico..." value="" data-dia="${dia}" data-index="${newIndex}" data-color="">
        <button type="button" class="btn-color-topico no-color"
            data-dia="${dia}" data-index="${newIndex}" data-color=""
            style="background:#fff;border-style:dashed;" onclick="alternarCorTopico(this)" title="Sem cor"></button>
        <button type="button" class="btn btn-sm btn-ghost cronograma-add-topico" 
                data-dia="${dia}" data-index="${newIndex}"
                style="padding:2px 8px;font-size:14px;line-height:1"
                onclick="addTopico(this, ${dia}, ${newIndex})">+</button>
        <button type="button" class="btn btn-sm btn-ghost cronograma-remove-topico"
                data-dia="${dia}" data-index="${newIndex}"
                style="padding:2px 8px;font-size:14px;line-height:1;color:var(--danger)"
                onclick="removeTopico(this, ${dia}, ${newIndex})">×</button>
    `;
    refDiv.parentNode.insertBefore(newDiv, refDiv.nextSibling);
    reindexTopicos(cell);
    newDiv.querySelector('input').focus();
}

function removeTopico(btn, dia, index) {
    if (index === 0) {
        showToast('O primeiro tópico não pode ser removido.', 'error');
        return;
    }
    const div = btn.closest('.topico-row');
    if (!div) return;
    const cell = div.parentNode;
    div.remove();
    reindexTopicos(cell);
}

function reindexTopicos(cell) {
    const divs = cell.querySelectorAll('.topico-row');
    divs.forEach((div, idx) => {
        const input = div.querySelector('.cronograma-topico');
        if (input) input.dataset.index = idx;
        const colorBtn = div.querySelector('.btn-color-topico');
        if (colorBtn) colorBtn.dataset.index = idx;
        const addBtn = div.querySelector('.cronograma-add-topico');
        if (addBtn) addBtn.dataset.index = idx;
        const removeBtn = div.querySelector('.cronograma-remove-topico');
        if (removeBtn) removeBtn.dataset.index = idx;
        if (addBtn) addBtn.setAttribute('onclick', `addTopico(this, ${parseInt(addBtn.dataset.dia)}, ${idx})`);
        if (removeBtn) removeBtn.setAttribute('onclick', `removeTopico(this, ${parseInt(removeBtn.dataset.dia)}, ${idx})`);
        if (colorBtn) colorBtn.setAttribute('onclick', `alternarCorTopico(this)`);
        if (idx === 0 && removeBtn) {
            removeBtn.style.display = 'none';
        } else if (removeBtn) {
            removeBtn.style.display = '';
        }
    });
}

function salvarCronograma() {
    const mes = parseInt(document.getElementById('cronogramaMes').value);
    const ano = parseInt(document.getElementById('cronogramaAno').value);

    const existente = getCronogramaData().some(r => r.mes === mes && r.ano === ano);

    const mapaPorDia = {};
    document.querySelectorAll('#cronogramaTableBody .cronograma-topico').forEach(inp => {
        const dia   = parseInt(inp.dataset.dia);
        const valor = inp.value.trim();
        const cor   = inp.dataset.color || null;
        if (!mapaPorDia[dia]) mapaPorDia[dia] = { dia, mes, ano, topicos: [] };
        if (valor) mapaPorDia[dia].topicos.push({ t: valor, c: cor });
    });

    const novos  = Object.values(mapaPorDia).filter(r => r.topicos.length > 0);
    const merged = [...getCronogramaData().filter(r => !(r.mes === mes && r.ano === ano)), ...novos];
    saveCronogramaData(merged);

    const nomeMes = obterNomeMes(mes);
    const label = nomeMes + '/' + ano;
    if (!existente && novos.length > 0) {
        registrarLog('cronograma', 'criado', 'Cronograma', label,
            'Cronograma criado para ' + label + ' com ' + novos.length + ' dias programados.');
    } else if (novos.length > 0) {
        const totalTopicos = novos.reduce((s, d) => s + d.topicos.length, 0);
        registrarLog('cronograma', 'atualizado', 'Cronograma', label,
            'Atualização do cronograma de ' + label + ' — ' + novos.length + ' dias, ' + totalTopicos + ' tópicos.');
    } else {
        registrarLog('cronograma', 'atualizado', 'Cronograma', label,
            'Cronograma de ' + label + ' foi esvaziado (nenhum tópico).');
    }

    showToast('Cronograma salvo! ✅', 'success');
    renderPainelRegistro();
}

// ----------------------------------------------------------------------
// IMPRESSÃO DO CRONOGRAMA — LAYOUT SEMANAL COM IMAGENS, ASSINATURAS E RODAPÉ FIXO
// ----------------------------------------------------------------------
function imprimirCronograma() {
    const mesSel = document.getElementById('cronogramaMes');
    const anoSel = document.getElementById('cronogramaAno');
    const mes = parseInt(mesSel.value);
    const ano = parseInt(anoSel.value);
    const nomeMes = mesSel.options[mesSel.selectedIndex].text.split(' - ')[0] || `Mês ${mes}`;

    // Coleta os tópicos do DOM (editável)
    const mapaPorDia = {};
    document.querySelectorAll('#cronogramaTableBody .cronograma-topico').forEach(inp => {
        const dia = parseInt(inp.dataset.dia);
        const valor = inp.value.trim();
        const cor = inp.dataset.color || null;
        if (!mapaPorDia[dia]) mapaPorDia[dia] = { dia, topicos: [] };
        if (valor) mapaPorDia[dia].topicos.push({ t: valor, c: cor });
    });

    const diasComTopico = Object.values(mapaPorDia)
        .filter(r => r.topicos.length > 0)
        .sort((a, b) => a.dia - b.dia);

    if (!diasComTopico.length) {
        showToast('Nenhum registro no cronograma para imprimir!', 'error');
        return;
    }

    // Calcula o primeiro dia do mês e total de dias
    const primeiroDia = new Date(ano, mes - 1, 1).getDay(); // 0=domingo
    const totalDias = new Date(ano, mes, 0).getDate();

    // Monta matriz de semanas (6 linhas x 7 colunas)
    const semanas = [];
    let semanaAtual = [];
    for (let i = 0; i < primeiroDia; i++) semanaAtual.push(null);
    for (let dia = 1; dia <= totalDias; dia++) {
        semanaAtual.push(dia);
        if (semanaAtual.length === 7) {
            semanas.push(semanaAtual);
            semanaAtual = [];
        }
    }
    if (semanaAtual.length > 0) {
        while (semanaAtual.length < 7) semanaAtual.push(null);
        semanas.push(semanaAtual);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const colorHex = { red: '#e05a6b', green: '#6bcb8b', blue: '#3a7dc9' };
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let tableRows = '';
    semanas.forEach(semana => {
        let cells = semana.map(dia => {
            if (dia === null) {
                return `<td class="empty-cell"></td>`;
            }
            const reg = mapaPorDia[dia];
            const topicos = reg ? reg.topicos : [];
            const topicoHtml = topicos.length
                ? topicos.map(t => {
                    const dot = t.c ? `<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:${colorHex[t.c] || '#ccc'};margin-right:3px;vertical-align:middle;"></span>` : '';
                    return dot + esc(t.t);
                  }).join('<br>')
                : '<span style="color:#ccc;font-style:italic;">—</span>';

            const diaSemana = new Date(ano, mes - 1, dia).getDay();
            const isWeekend = (diaSemana === 0 || diaSemana === 6);
            return `<td class="${isWeekend ? 'weekend-cell' : ''}">
                        <div class="day-number">${String(dia).padStart(2, '0')}</div>
                        <div class="day-topics">${topicoHtml}</div>
                    </td>`;
        }).join('');
        tableRows += `<tr>${cells}</tr>`;
    });

    // Cabeçalho com imagens e texto - borda inferior branca (removida)
    const headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 8px;border-bottom:2px solid #fff;margin-bottom:6px;">
            <div style="flex:0 0 auto;">
                <img src="assets/prefcareiro.jpg" alt="Prefeitura" style="height:40px;width:auto;">
            </div>
            <div style="flex:1;text-align:center;">
                <div style="font-size:16px;font-weight:600;color:#222;letter-spacing:1px;text-transform:uppercase;">Cronograma – Visa</div>
                <div style="font-size:12px;color:#555;margin-top:2px;">${nomeMes} / ${ano} &nbsp;·&nbsp; ${dateStr} ${timeStr}</div>
            </div>
            <div style="flex:0 0 auto;">
                <img src="assets/semsa.jpg" alt="SEMSA" style="height:40px;width:auto;">
            </div>
        </div>
    `;

    // Tabela - sem bordas cinza externas
    const bodyHtml = `
        <div class="print-body" style="padding:0 6px; flex:1; overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;">
                <thead>
                    <tr style="background:#f48aab;color:#fff;">
                        ${diasSemana.map(d => `<th style="padding:4px 3px;text-align:center;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #000;">${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;

    // Espaço para assinaturas - borda superior branca (removida)
    const assinaturasHtml = `
        <div style="display:flex;justify-content:space-between;padding:4px 6px 0 6px;border-top:1px solid #fff;margin-top:4px;">
            <div style="text-align:center;width:45%;">
                <div style="border-bottom:1px solid #000;min-height:20px;margin-bottom:3px;"></div>
                <div style="font-size:9px;font-weight:600;color:#333;">Coordenadora de Logística</div>
            </div>
            <div style="text-align:center;width:45%;">
                <div style="border-bottom:1px solid #000;min-height:20px;margin-bottom:3px;"></div>
                <div style="font-size:9px;font-weight:600;color:#333;">Secretaria da SEMSA</div>
            </div>
        </div>
    `;

    // Rodapé com endereço e timbre (borda rosa mantida)
    const footerHtml = `
        <div style="border-top:2px solid #f48aab; padding-top:6px; margin-top:4px; display:flex; justify-content:space-between; align-items:center; font-size:8px; color:#555;">
            <div>
                Av. Mário Jorge Guedes, nº 391, Centro – Careiro<br>
                Sede da Prefeitura – CEP: 69250-000<br>
                e-mail: sms-careiro@saude.am.gov.br
            </div>
            <div style="flex:0 0 auto;">
                <img src="assets/timbre.jpg" alt="Timbre" style="height:40px;width:auto;">
            </div>
        </div>
    `;

    // Container principal
    const html = `
        <div style="display:flex; flex-direction:column; height:100vh; padding:6px; justify-content:space-between;">
            ${headerHtml}
            <div style="flex:1; display:flex; flex-direction:column; min-height:0;">
                ${bodyHtml}
                ${assinaturasHtml}
            </div>
            ${footerHtml}
        </div>
    `;

    // Estilos extras
    const estiloExtra = `
        .print-body table td {
            padding: 3px 2px;
            border: 1px solid #000;
            vertical-align: top;
            height: 38px;
            min-width: 60px;
            background: #fff;
            position: relative;
        }
        .print-body table td.weekend-cell {
            background: #faf0f2;
        }
        .print-body table td .day-number {
            font-weight: 700;
            font-size: 12px;
            color: #f48aab;
            margin-bottom: 0;
            text-align: right;
            padding-right: 4px;
            position: absolute;
            top: 2px;
            right: 3px;
            line-height: 1.2;
        }
        .print-body table td .day-topics {
            font-size: 9px;
            line-height: 1.3;
            color: #222;
            margin-top: 14px;
            padding: 0 2px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .print-body table td.empty-cell {
            background: #f0f0f0;
            border-color: #000;
        }
        @media print {
            .print-body table td {
                height: 32px;
                padding: 2px;
            }
            .print-body table td .day-topics {
                font-size: 8px;
                margin-top: 12px;
            }
            .print-body table td .day-number {
                font-size: 10px;
            }
            body { margin: 0; padding: 0; }
        }
        @page {
            size: landscape;
            margin: 6mm;
        }
        body {
            padding: 0;
            margin: 0;
        }
    `;

    const win = window.open('', '_blank', 'width=1000,height=700,menubar=no,toolbar=no,scrollbars=yes');
    win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<title>Cronograma - Visa</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #fff; color: #1a1a2e; }
    ${_printStyles()}
    ${estiloExtra}
</style>
</head>
<body>${html}
<script>
    window.onload = function() {
        window.print();
        window.onfocus = function() { window.close(); };
    };
<\/script>
</body></html>`);
    win.document.close();
}

// ============================================================
// LEGISLAÇÃO
// ============================================================
function renderLegislacao() {
    const lista     = getLegislacaoData();
    const container = document.getElementById('legislacaoList');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📚</div><h3>Nenhum documento cadastrado</h3><p>Adicione links de legislação sanitária.</p></div>';
        return;
    }

    container.innerHTML = lista.map((doc, i) => `
        <div class="legislacao-card">
            <div class="leg-info">
                <div class="leg-nome">${esc(doc.nome)}</div>
                ${doc.categoria ? `<div class="leg-cat">📁 ${esc(doc.categoria)}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
                <button class="btn btn-primary btn-sm" onclick="window.open('${esc(doc.link)}','_blank')">🔗 Abrir</button>
                <button class="btn btn-ghost   btn-sm" onclick="openEditLegislacao(${i})">✏️</button>
                <button class="btn btn-danger  btn-sm" onclick="removeLegislacao(${i})">🗑️</button>
            </div>
        </div>`).join('');
}

function openAddLegislacao() {
    document.getElementById('legModalTitle').textContent = '＋ Novo Documento';
    document.getElementById('legNome').value     = '';
    document.getElementById('legLink').value     = '';
    document.getElementById('legCategoria').value = '';
    document.getElementById('legEditId').value   = '';
    openModal('modalLegislacao');
}

function openEditLegislacao(index) {
    const doc = getLegislacaoData()[index];
    if (!doc) return;
    document.getElementById('legModalTitle').textContent = '✏️ Editar Documento';
    document.getElementById('legNome').value      = doc.nome      || '';
    document.getElementById('legLink').value      = doc.link      || '';
    document.getElementById('legCategoria').value = doc.categoria || '';
    document.getElementById('legEditId').value    = index;
    openModal('modalLegislacao');
}

function saveLegislacao() {
    const nome      = document.getElementById('legNome').value.trim();
    const link      = document.getElementById('legLink').value.trim();
    const categoria = document.getElementById('legCategoria').value.trim();
    const editId    = document.getElementById('legEditId').value;

    if (!nome) { showToast('Informe o nome do documento!', 'error'); return; }
    if (!link) { showToast('Informe o link do documento!', 'error'); return; }

    const lista = getLegislacaoData();
    const entry = { nome, link, categoria };
    if (editId !== '') {
        const idx = parseInt(editId);
        if (idx >= 0 && idx < lista.length) { lista[idx] = entry; showToast('Documento atualizado! ✅', 'success'); }
        else { showToast('Erro ao atualizar.', 'error'); return; }
    } else {
        lista.push(entry);
        showToast('Documento adicionado! ✅', 'success');
        registrarLog('configuracao', 'adicionado', 'Legislação', nome,
            'Documento "' + nome + '" adicionado à biblioteca' + (categoria ? ' (categoria: ' + categoria + ')' : ''));
    }
    saveLegislacaoData(lista);
    closeModal('modalLegislacao');
    renderLegislacao();
}

function removeLegislacao(index) {
    if (!confirm('Remover este documento da biblioteca?')) return;
    const lista = getLegislacaoData();
    const doc = lista[index];
    if (doc) {
        registrarLog('configuracao', 'removido', 'Legislação', doc.nome || 'Documento',
            'Documento "' + (doc.nome || 'sem nome') + '" removido da biblioteca.');
    }
    lista.splice(index, 1);
    saveLegislacaoData(lista);
    renderLegislacao();
    showToast('Documento removido.', 'success');
}

// ============================================================
// CONFIGURAÇÕES (com gerenciamento de usuários)
// ============================================================
function renderConfig() {
    renderBairroTags();
    renderUsersManagement();
    updateConfigStats();
    initConfigSwitches();
    const inputMeses = document.getElementById('inputMesesValidade');
    if (inputMeses) {
        inputMeses.value = getConfig().mesesValidadeFiscalizacao || 4;
    }
    // Carrega configurações do alvará
    carregarConfigAlvaraUI();
}

async function carregarConfigAlvaraUI() {
    const config = await getConfigAlvara();
    document.getElementById('configSecretaria').value = config.secretaria || '';
    document.getElementById('configCoordenadora').value = config.coordenadora || '';
    document.getElementById('configPortariaSecretaria').value = config.portariaSecretaria || '';
    document.getElementById('configPortariaCoordenadora').value = config.portariaCoordenadora || '';
}

async function salvarConfigAlvaraUI() {
    const secretaria = document.getElementById('configSecretaria').value.trim();
    const coordenadora = document.getElementById('configCoordenadora').value.trim();
    const portariaSecretaria = document.getElementById('configPortariaSecretaria').value.trim();
    const portariaCoordenadora = document.getElementById('configPortariaCoordenadora').value.trim();

    if (!secretaria || !coordenadora) {
        showToast('Preencha pelo menos os nomes.', 'error');
        return;
    }
    try {
        await salvarConfigAlvara(secretaria, coordenadora, portariaSecretaria, portariaCoordenadora);
        document.getElementById('configAlvaraStatus').textContent = '✅ Salvo com sucesso!';
        setTimeout(() => {
            document.getElementById('configAlvaraStatus').textContent = '';
        }, 3000);
        showToast('Configuração do alvará atualizada!', 'success');
        registrarLog('configuracao', 'alterado', 'Configuração', 'Alvará',
            'Nomes e portarias do alvará atualizados.');
        renderPainelRegistro();
    } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
    }
}

function initConfigSwitches() {
    const switchCpf      = document.getElementById('switchCpfObrigatorio');
    const switchExclusao = document.getElementById('switchPermitirExclusao');
    if (switchCpf)      switchCpf.checked      = getConfig().cpfObrigatorio !== false;
    if (switchExclusao) switchExclusao.checked  = getConfig().permitirExclusaoInativos === true;
}

function handleSwitchChange(switchEl, configKey) {
    const newValue = switchEl.checked;
    switchEl.checked = !newValue;

    promptAdminPassword(
        () => {
            switchEl.checked = newValue;
            if (configKey === 'cpfObrigatorio') {
                _fbCache.config.cpfObrigatorio = newValue;
                _saveField('config', _fbCache.config);
                updateCpfLabel();
                registrarLog('configuracao', 'alterado', 'Configuração', 'CPF/CNPJ obrigatório',
                    newValue ? 'CPF/CNPJ passou a ser obrigatório nos cadastros.' :
                               'CPF/CNPJ deixou de ser obrigatório nos cadastros.');
                showToast(newValue ? 'CPF/CNPJ agora é obrigatório.' : 'CPF/CNPJ não é mais obrigatório.', 'success');
            } else if (configKey === 'permitirExclusao') {
                _fbCache.config.permitirExclusaoInativos = newValue;
                _saveField('config', _fbCache.config);
                registrarLog('configuracao', 'alterado', 'Configuração', 'Exclusão permanente',
                    newValue ? 'Exclusão permanente de inativos foi habilitada.' :
                               'Exclusão permanente de inativos foi desabilitada.');
                showToast(newValue ? 'Exclusão permanente habilitada.' : 'Exclusão permanente desabilitada.', 'success');
                if (currentPage === 'inativos') renderInativos();
            }
            renderPainelRegistro();
        },
        () => {}
    );
}

function saveMesesValidade() {
    const input = document.getElementById('inputMesesValidade');
    let valor = parseInt(input.value);
    if (isNaN(valor) || valor < 1) {
        showToast('Informe um número inteiro maior ou igual a 1.', 'error');
        input.value = getConfig().mesesValidadeFiscalizacao || 4;
        return;
    }
    const valorAntigo = _fbCache.config.mesesValidadeFiscalizacao || 4;
    _fbCache.config.mesesValidadeFiscalizacao = valor;
    _saveField('config', _fbCache.config);
    registrarLog('configuracao', 'alterado', 'Configuração', 'Prazo de validade',
        'Prazo de validade da fiscalização alterado de ' + valorAntigo + ' para ' + valor + ' meses.');
    showToast(`Prazo de validade atualizado para ${valor} meses. ✅`, 'success');
    if (currentPage === 'dashboard') renderDashboard();
    if (currentPage === 'estabelecimentos') renderTable();
    if (currentPage === 'inativos') renderInativos();
    renderPainelRegistro();
}

function renderBairroTags() {
    const list = document.getElementById('bairroTagList');
    if (!list) return;
    const bairros = getBairros().slice().sort((a, b) => a.localeCompare(b));
    list.innerHTML = bairros.length
        ? bairros.map(b => {
            const escapedName = esc(b).replace(/'/g, "\\'");
            return `<span class="bairro-tag">📍 ${esc(b)}<button onclick="removeBairroByName('${escapedName}')" title="Remover">✕</button></span>`;
          }).join('')
        : '<span style="font-size:13px;color:var(--text-muted)">Nenhuma localidade cadastrada.</span>';
}

let _pendingDelBairroName = null;

function addBairro() {
    const input = document.getElementById('newBairroName');
    const name  = input?.value.trim().toUpperCase();
    if (!name) { showToast('Informe o nome da localidade!', 'error'); return; }
    const bairros = getBairros();
    if (bairros.some(b => b.toUpperCase() === name)) { showToast('Localidade já cadastrada!', 'error'); return; }
    bairros.push(name);
    saveBairros(bairros);
    if (input) input.value = '';
    renderBairroTags();
    refreshAllBairroDropdowns();
    registrarLog('configuracao', 'adicionado', 'Localidade', name,
        'Nova localidade "' + name + '" adicionada ao sistema.');
    showToast('Localidade adicionada! ✅', 'success');
    renderPainelRegistro();
}

function removeBairroByName(nome) {
    const bairros = getBairros();
    const idx     = bairros.findIndex(b => b === nome);
    if (idx === -1) { showToast('Localidade não encontrada.', 'error'); return; }
    const vinculados = DADOS.filter(d => d.bairro === nome).length;
    if (vinculados > 0) {
        showToast(`Não é possível excluir: ${vinculados} estabelecimento${vinculados > 1 ? 's' : ''} vinculado${vinculados > 1 ? 's' : ''} a "${nome}".`, 'error');
        return;
    }
    _pendingDelBairroName = nome;
    document.getElementById('delBairroLabel').textContent = nome;
    openModal('modalConfirmDelBairro');
}

function confirmRemoveBairro() {
    const nome    = _pendingDelBairroName;
    if (!nome) return;
    const bairros = getBairros();
    const idx     = bairros.findIndex(b => b === nome);
    if (idx !== -1) {
        bairros.splice(idx, 1);
        saveBairros(bairros);
        renderBairroTags();
        refreshAllBairroDropdowns();
        registrarLog('configuracao', 'removido', 'Localidade', nome,
            'Localidade "' + nome + '" removida do sistema.');
        showToast('Localidade removida.', 'success');
    } else {
        showToast('Localidade não encontrada para remoção.', 'error');
    }
    closeModal('modalConfirmDelBairro');
    _pendingDelBairroName = null;
    renderPainelRegistro();
}

function updateConfigStats() {
    const estabs  = DADOS.filter(r => !isDisabled(r.id)).length;
    const inativos = DADOS.filter(r => isDisabled(r.id)).length;
    const edited  = Object.keys(getEditedMap()).length;
    const el = document.getElementById('configStats');
    if (el) el.innerHTML = `Sistema: <strong>${estabs}</strong> estabelecimentos ativos &nbsp;|&nbsp; <strong>${inativos}</strong> inativos &nbsp;|&nbsp; <span style="color:#3a7dc9">${edited} editados</span>`;
}

// ============================================================
// GERENCIAMENTO DE USUÁRIOS (com senha administrativa)
// ============================================================
let _usuarioEditandoId = null;

function renderUsersManagement() {
    const container = document.getElementById('usersManagementContainer');
    if (!container) return;
    const users = getUsers();
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-family:'Playfair Display',serif;font-size:16px;">👥 Usuários do Sistema</h3>
            <button class="btn btn-primary btn-sm" onclick="promptAddUser()">+ Adicionar</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
            ${users.map(u => `
                <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.6);border-radius:8px;padding:8px 12px;border:1px solid var(--border);">
                    <div style="font-weight:600;">${esc(u.nome)}</div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-ghost btn-sm" onclick="promptRenameUser(${u.id})">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="promptRemoveUser(${u.id})">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">
            Usuário atual: <strong>${esc(getCurrentUserName() || 'Nenhum')}</strong>
        </div>
    `;
    container.innerHTML = html;
}

function promptAddUser() {
    promptAdminPassword(
        () => {
            const nome = prompt('Digite o nome do novo usuário:');
            if (!nome || !nome.trim()) return;
            const users = getUsers();
            const novoId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: novoId, nome: nome.trim() });
            saveUsers(users);
            registrarLog('configuracao', 'adicionado', 'Usuário', nome.trim(),
                'Novo usuário "' + nome.trim() + '" adicionado ao sistema.');
            renderUsersManagement();
            showToast('Usuário adicionado!', 'success');
        },
        () => {}
    );
}

function promptRenameUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    promptAdminPassword(
        () => {
            const novoNome = prompt('Novo nome para "' + user.nome + '":', user.nome);
            if (!novoNome || !novoNome.trim()) return;
            const nomeAntigo = user.nome;
            user.nome = novoNome.trim();
            saveUsers(users);
            registrarLog('configuracao', 'alterado', 'Usuário', user.nome,
                'Usuário "' + nomeAntigo + '" renomeado para "' + user.nome + '".');
            // Se o usuário atual for o renomeado, atualiza o localStorage
            if (getCurrentUserName() === nomeAntigo) {
                setCurrentUserName(user.nome);
            }
            renderUsersManagement();
            showToast('Usuário renomeado!', 'success');
        },
        () => {}
    );
}

function promptRemoveUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (users.length <= 1) {
        showToast('Não é possível remover o único usuário.', 'error');
        return;
    }
    if (!confirm('Remover o usuário "' + user.nome + '" permanentemente?')) return;
    promptAdminPassword(
        () => {
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) return;
            const nomeRemovido = users[idx].nome;
            users.splice(idx, 1);
            saveUsers(users);
            registrarLog('configuracao', 'removido', 'Usuário', nomeRemovido,
                'Usuário "' + nomeRemovido + '" removido do sistema.');
            // Se o usuário atual foi removido, limpa a escolha e força nova seleção
            if (getCurrentUserName() === nomeRemovido) {
                setCurrentUserName(null);
                // Recarrega para mostrar modal de seleção
                setTimeout(() => window.location.reload(), 500);
            }
            renderUsersManagement();
            showToast('Usuário removido!', 'success');
        },
        () => {}
    );
}

// ============================================================
// BACKUP
// ============================================================
async function backupData() {
    const disabledSet = new Set(getDisabledIds().map(String));
    const data = {
        version:           5,
        exportedAt:        new Date().toISOString(),
        config:            getConfig(),
        custom:            getCustom(),
        deleted:           getDeletedIds(),
        disabled:          getDisabledIds(),
        edited:            getEditedMap(),
        bairros:           getBairros(),
        estabelecimentos:  _DADOS_ORIGINAL.filter(r => !disabledSet.has(String(r.id))),
        inativos_data:     getInativosData(),
        cronograma_data:   getCronogramaData(),
        legislacao_data:   getLegislacaoData(),
        fiscalizacoes_data: getFiscalizacoesData(),
        audit_logs:        getAuditLogs(),
        users:             getUsers() // inclui lista de usuários
    };
    downloadJSON(data, 'backup_completo_cadvisa_' + new Date().toISOString().slice(0, 10) + '.json');
    showToast('Backup completo exportado! ✅', 'success');
    registrarLog('configuracao', 'atualizado', 'Backup', 'Exportação',
        'Backup completo exportado com ' + data.estabelecimentos.length + ' estabelecimentos, ' + data.users.length + ' usuários e ' + data.audit_logs.length + ' registros de auditoria.');
}

function importBackup() { document.getElementById('importFile').click(); }

function doImport(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    readJSON(file, async data => {
        try {
            const summary = {};
            if (data.config)   { _fbCache.config = data.config; _saveField('config', data.config); }
            if (data.custom)   saveCustom(data.custom);
            if (data.deleted)  saveDeletedIds(data.deleted);
            if (data.disabled) saveDisabledIds(data.disabled);
            if (data.edited)   saveEditedMap(data.edited);

            if (data.bairros?.length)           { saveBairros(data.bairros);            summary.bairros      = data.bairros.length; }
            if (data.cronograma_data?.length)    { saveCronogramaData(data.cronograma_data);   summary.cronograma   = data.cronograma_data.length; }
            if (data.legislacao_data?.length)    { saveLegislacaoData(data.legislacao_data);   summary.legislacao   = data.legislacao_data.length; }
            if (data.fiscalizacoes_data?.length) { saveFiscalizacoesData(data.fiscalizacoes_data); summary.fiscalizacoes = data.fiscalizacoes_data.length; }

            if (data.audit_logs?.length) {
                saveAuditLogs(data.audit_logs);
                summary.audit_logs = data.audit_logs.length;
            }

            if (data.users?.length) {
                saveUsers(data.users);
                summary.users = data.users.length;
            }

            if (Array.isArray(data.estabelecimentos) && data.estabelecimentos.length) {
                const disabledSet  = new Set((data.disabled || []).map(String));
                const apenasAtivos = data.estabelecimentos.filter(r => !disabledSet.has(String(r.id)));
                await _BASE_REF.set({ estabelecimentos: apenasAtivos, importedAt: new Date().toISOString(), total: apenasAtivos.length });
                _DADOS_ORIGINAL.length = 0;
                apenasAtivos.forEach(r => _DADOS_ORIGINAL.push(r));
                summary.ativos = apenasAtivos.length;
            }

            if (Array.isArray(data.inativos_data) && data.inativos_data.length) {
                await saveInativosData(data.inativos_data);
                summary.inativos = data.inativos_data.length;
            }

            rebuildDADOS();
            refreshAllCategoryDropdowns();
            refreshAllBairroDropdowns();
            renderConfig();
            refreshAfterChange();
            renderPainelRegistro();

            const resultEl = document.getElementById('backupImportResult');
            if (resultEl) {
                const linhas = [
                    summary.ativos      != null ? `🏢 <strong>${summary.ativos}</strong> estabelecimento${summary.ativos !== 1 ? 's' : ''} ativo${summary.ativos !== 1 ? 's' : ''}` : null,
                    summary.inativos    != null ? `🚫 <strong>${summary.inativos}</strong> estabelecimento${summary.inativos !== 1 ? 's' : ''} inativo${summary.inativos !== 1 ? 's' : ''}` : null,
                    summary.bairros     != null ? `📍 <strong>${summary.bairros}</strong> localidade${summary.bairros !== 1 ? 's' : ''}` : null,
                    summary.cronograma  != null ? `📅 <strong>${summary.cronograma}</strong> registros de cronograma` : null,
                    summary.legislacao  != null ? `📚 <strong>${summary.legislacao}</strong> documentos de legislação` : null,
                    summary.fiscalizacoes != null ? `📋 <strong>${summary.fiscalizacoes}</strong> ações de fiscalização` : null,
                    summary.audit_logs  != null ? `📋 <strong>${summary.audit_logs}</strong> registros de auditoria` : null,
                    summary.users       != null ? `👥 <strong>${summary.users}</strong> usuário${summary.users !== 1 ? 's' : ''}` : null,
                ].filter(Boolean);
                resultEl.style.display    = 'block';
                resultEl.style.background = 'var(--success-bg)';
                resultEl.style.border     = '1.5px solid var(--success)';
                resultEl.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:10px">✅ Backup restaurado com sucesso!</div>
                    <div style="display:flex;flex-direction:column;gap:5px">${linhas.map(r => `<div>${r}</div>`).join('')}</div>`;
            }
            registrarLog('configuracao', 'atualizado', 'Backup', 'Importação',
                'Backup completo importado via arquivo JSON.');
            showToast('Backup universal restaurado! ✅', 'success');
        } catch (err) {
            showToast('Arquivo inválido: ' + err.message, 'error');
        }
    });
}

// ============================================================
// ESTILOS DE IMPRESSÃO (usados por imprimirHTML)
// ============================================================
function _printStyles() {
    return `*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;color:#1a1a2e;background:#fff;padding:8px;font-size:8.5px;}.print-header{background:#f48aab;color:white;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-radius:7px 7px 0 0;}.print-header h1{font-family:'Playfair Display',serif;font-size:13px;font-weight:700;}.print-header>div:first-child>div:first-child{font-size:8px;opacity:.85;letter-spacing:.6px;text-transform:uppercase;}.print-meta{font-size:8.5px;opacity:.9;text-align:right;white-space:nowrap;}.print-body{padding:10px 14px;}.print-section-title{font-family:'Playfair Display',serif;font-size:10.5px;border-bottom:1.5px solid #f48aab;padding-bottom:3px;margin:9px 0 6px;color:#f48aab;}.print-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;}.print-stat{background:#fde8ee;border:1px solid #f5c6d4;border-radius:5px;padding:6px 5px;text-align:center;}.pv{font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:#f48aab;line-height:1;}.pl{font-size:7.5px;color:#b08090;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;}table{width:100%;border-collapse:collapse;font-size:8px;}thead tr{background:#f48aab;color:white;}th{padding:4px 5px;text-align:left;font-weight:700;font-size:7.5px;letter-spacing:.3px;text-transform:uppercase;white-space:nowrap;}td{padding:3.5px 5px;border-bottom:1px solid #fae8f0;vertical-align:middle;font-size:8px;}tr:nth-child(even) td{background:#fff5f8;}.print-footer{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px;border-top:1.5px solid #eee;padding-top:12px;page-break-inside:avoid;break-inside:avoid;}.sign-line{border-top:1px solid #333;margin-top:26px;padding-top:4px;font-size:8.5px;color:#555;text-align:center;}@media print{body{padding:0;}@page{size:landscape;margin:5mm;}.print-footer{page-break-inside:avoid;break-inside:avoid;}}`;
}