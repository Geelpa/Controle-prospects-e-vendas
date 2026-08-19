function processData(prospectData, salesData) {
    // 1. FUNÇÃO AUXILIAR: Converte valores da planilha tratando formatos
    const parseNumber = (value) => {
        if (value === undefined || value === null || String(value).trim() === "") return 0;
        if (typeof value === 'number') return value;

        let cleanValue = value.toString().replace(/[R$\s]/g, '').trim();
        if (cleanValue.includes(',') && cleanValue.includes('.')) {
            cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
        } else {
            cleanValue = cleanValue.replace(',', '.');
        }

        if ((cleanValue.match(/\./g) || []).length > 1) {
            const parts = cleanValue.split('.');
            cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
        }

        const result = parseFloat(cleanValue);
        return isNaN(result) ? 0 : result;
    };

    // 2. FUNÇÃO AUXILIAR: Identifica e ignora movimentações de base
    const isAdditionalPlan = (item) => {
        const plano = normalize(item[COLUMN_MAP.plano] || "");
        const campanha = normalize(item[COLUMN_MAP.campanha] || "");
        const canal = normalize(item[COLUMN_MAP.canal] || "");

        return ["adicional"].some(term =>
            plano.includes(term) || campanha.includes(term) || canal.includes(term)
        );
    };

    const isNewProspect = (item) => !isAdditionalPlan(item);

    // --- BLOCO 1: CONVERSÃO E QUANTIDADES COMERCIAIS (VERSÃO DE ALTA PRECISÃO - 124) ---

    const prospectsData = (prospectData || []).filter(item => isNewProspect(item, COLUMN_MAP));
    currentFilteredData = salesData || [];
    currentProspectFilteredData = prospectsData;
    const currentProspectData = prospectsData;
    const totalProspects = prospectsData.length;

    // As vendas e ativações devem considerar também adicionais e troca de titularidade,
    // porque ambos podem gerar contrato novo mesmo sem serem "prospect novo".
    const wonRows = getUniqueWonRows(salesData || []);
    const won = wonRows.length;
    const salesPerformanceRows = wonRows.filter(item => !isOwnershipTransferChannel(item));

    // PERDEMOS: apenas status 'perdemos'
    const lost = prospectsData.filter(item =>
        STATUS.lost.includes(normalize(item[COLUMN_MAP.status]))
    ).length;

    // SEM VIABILIDADE: apenas status 'sem viabilidade'
    const noViability = prospectsData.filter(item =>
        STATUS.noViability.includes(normalize(item[COLUMN_MAP.status]))
    ).length;

    // EM ANDAMENTO: todos os prospects com status diferentes de vencemos, perdemos, abortamos ou sem viabilidade
    const inProgress = prospectsData.filter(item => {
        const s = normalize(item[COLUMN_MAP.status]);
        return (
            !STATUS.won.includes(s) &&
            !STATUS.lost.includes(s) &&
            !STATUS.noViability.includes(s) &&
            s !== "abortamos"
        )
    }).length;

    // Oportunidades trabalhadas: apenas aqueles com status 'vencemos' ou 'perdemos'
    const workableSales = prospectsData.filter(item => {
        const s = normalize(item[COLUMN_MAP.status]);
        return STATUS.won.includes(s) || STATUS.lost.includes(s);
    }).length;

    const safeWorkableSales = workableSales < won ? won : workableSales;

    const conversion =
        safeWorkableSales > 0
            ? ((won / safeWorkableSales) * 100).toFixed(1)
            : 0;


    // --- BLOCO 2: FINANCEIRO (INTEGRALMENTE RESTAURADO) ---
    // Inclui vendas de planos adicionais como receita de contrato, mas continua tratando
    // os adicionais como prospects existentes para o funil de novos prospects.
    let totalRevenue = 0;
    let totalTaxRevenue = 0;
    let validContractCount = 0;

    // Para manter coerência, os financeiros consideram apenas os prospects válidos (mesma base usada nos KPIs)
    const wonOnly = wonRows;

    wonOnly.forEach(item => {
        const price = parseNumber(item[COLUMN_MAP.valorContrato]);
        const tax = parseNumber(item[COLUMN_MAP.taxaAtivacao]);

        if (price > 0) {
            totalRevenue += price;
            validContractCount++;
        }

        if (tax > 0) {
            totalTaxRevenue += tax;
        }
    });

    const avgValue = validContractCount > 0 ? totalRevenue / validContractCount : 0;

    // --- BLOCO 3: FORMATAÇÃO DOS RESULTADOS ---

    const averageTicket = avgValue.toLocaleString("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const formattedTaxRevenue = Math.round(totalTaxRevenue).toLocaleString("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    // --- BLOCO DE ATUALIZAÇÃO DOS CARDS NA TELA ---
    updateKPIs({
        total: totalProspects,
        won,
        lost,
        noViability,
        inProgress,
        conversion,
        averageTicket,
        totalTaxPaid: formattedTaxRevenue
    });

    // Executa a auditoria consolidada para ajudar a diagnosticar diferenças com o IXC
    try {
        logDashboardAudit(salesData || [], prospectsData, isNewProspect);
    } catch (e) { /** não quebrar a execução */ }     // === FUNÇÃO DE AUDITORIA DE VENDEDOR PARA GRÁFICOS E PÓDIOS ===
    // Retorna o Vendedor do Contrato se existir, caso contrário mantém o do Prospect.
    // Isso evita usar { ...item } e quebrar a leitura da planilha!
    const getSellersName = (item) => {
        const sellerFromContract = getContractSellerValue(item);
        if (sellerFromContract && String(sellerFromContract).trim() !== "" && normalize(sellerFromContract) !== "undefined") {
            return resolveSellerDisplayName(sellerFromContract) || sellerFromContract;
        }
        return resolveSellerDisplayName(getSellerValue(item)) || getSellerValue(item);
    };

    // Base de desempenho comercial: vendas reais, deduplicadas, com vendedor resolvido.
    const chartDataWithCorrectSellers = salesPerformanceRows.map(item => ({
        ...item,
        [COLUMN_MAP.vendedor]: getSellersName(item)
    }));

    // Gráficos de desempenho devem seguir a base real de vendas e manter status perdidos/andamento
    // para comparação; só o canal de venda exclui Troca de Titularidade.
    if (typeof createSellersChart === "function") createSellersChart(chartDataWithCorrectSellers);
    if (typeof createPlansChart === "function") createPlansChart(chartDataWithCorrectSellers);
    if (typeof createInstallationChart === "function") createInstallationChart(chartDataWithCorrectSellers);
    if (typeof createSalesPerDayChart === "function") createSalesPerDayChart(chartDataWithCorrectSellers);

    // Gráficos de funil e comparação de status continuam na base completa filtrada (vendas/ativação).
    if (typeof createChannelsChart === "function") createChannelsChart(salesData || []);
    if (typeof createCampaignsChart === "function") createCampaignsChart(salesData || []);
    if (typeof createLossReasonsChart === "function") createLossReasonsChart(salesData || []);
}

function logDashboardAudit(filteredRows, prospectsRows, isNewProspect) {
    const statusCounts = countBy(filteredRows, item =>
        normalize(item[COLUMN_MAP.status]) || "(sem status)"
    );

    const prospectStatusCounts = countBy(prospectsRows, item =>
        normalize(item[COLUMN_MAP.status]) || "(sem status)"
    );

    const strictWonRows = prospectsRows.filter(item =>
        STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
    );

    const computedWonRows = prospectsRows.filter(isWon);

    const financialOnlyWonRows = computedWonRows.filter(item =>
        !STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
    );

    const lostRows = prospectsRows.filter(item =>
        !isWon(item) && STATUS.lost.includes(normalize(item[COLUMN_MAP.status]))
    );

    const noViabilityRows = prospectsRows.filter(item =>
        !isWon(item) && STATUS.noViability.includes(normalize(item[COLUMN_MAP.status]))
    );

    const inProgressRows = prospectsRows.filter(item =>
        !isWon(item) && STATUS.inProgress.includes(normalize(item[COLUMN_MAP.status]))
    );

    const additionalRows = filteredRows.filter(item =>
        !isNewProspect(item)
    );

    const duplicateIdReport =
        getDuplicateIdReport(prospectsRows);

    const report = {
        linhasAposFiltrosCadastro: filteredRows.length,
        prospectsContadosNoDashboard: prospectsRows.length,
        removidosPorRegraAdicional: additionalRows.length,
        prospectsUnicosPorId: duplicateIdReport.uniqueCount,
        idsDuplicados: duplicateIdReport.duplicateIdCount,
        linhasDuplicadasPorId: duplicateIdReport.duplicateRowCount,
        vencemosPorStatus: strictWonRows.length,
        vencemosRegraAtual: computedWonRows.length,
        vencemosSomentePorContratoValor: financialOnlyWonRows.length,
        perdemosRegraAtual: lostRows.length,
        semViabilidadeRegraAtual: noViabilityRows.length,
        emAndamentoRegraAtual: inProgressRows.length
    };

    window.dashboardAudit = {
        report,
        statusCounts,
        prospectStatusCounts,
        additionalRows,
        financialOnlyWonRows,
        duplicateIds: duplicateIdReport.duplicates
    };

    console.group("Auditoria Dashboard Comercial");
    console.table(
        Object.entries(report)
            .map(([chave, valor]) => ({ chave, valor }))
    );
    console.log("Status apos filtros de cadastro:", statusCounts);
    console.log("Status dos prospects contados:", prospectStatusCounts);
    console.log("window.dashboardAudit", window.dashboardAudit);
    console.groupEnd();
}

function countBy(rows, getKey) {
    return rows.reduce((acc, row) => {
        const key = getKey(row);

        acc[key] = (acc[key] || 0) + 1;

        return acc;
    }, {});
}

function getDuplicateIdReport(rows) {
    const ids = rows
        .map(row => String(row[COLUMN_MAP.id] || "").trim())
        .filter(Boolean);

    const counts = ids.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;

        return acc;
    }, {});

    const duplicates = Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([id, count]) => ({ id, count }));

    const duplicateRowCount = duplicates.reduce(
        (sum, item) => sum + item.count,
        0
    );

    return {
        uniqueCount: Object.keys(counts).length,
        duplicateIdCount: duplicates.length,
        duplicateRowCount,
        duplicates
    };
}

function renderPodiums(currentData) {
    const rankingGroups = getPodiumRankingGroups(currentData);

    const bestItems = rankingGroups.map(group => {
        const first = group.entries[0];

        if (!first) return null;

        return {
            title: group.title,
            label: first[0],
            value: first[1],
            unit: group.unit
        };
    }).filter(Boolean);
    // OBS: O .sort() foi removido daqui para não embaralhar as categorias!

    renderPodiumList("bestPodiumList", bestItems);
}


function getPodiumRankingGroups(currentData) {
    const wonOnlyNormal = getUniqueWonRows(currentData).filter(item => !isOwnershipTransferChannel(item));
    const wonOnlySellers = getUniqueWonRows(currentData).filter(item => !isOwnershipTransferChannel(item));

    return [
        {
            title: "Vendedor",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlySellers, COLUMN_MAP.vendedor), 8)
        },
        {
            title: "Canal de Venda",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.canal), 8)
        },
        {
            title: "Campanha",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.campanha), 8)
        }
    ];
}

function getEfficiencyRanking(globalData, columnKey, minWinsRequired = 5) {
    const totalByGroup = {};
    const winsByGroup = {};

    globalData.forEach(item => {
        const value = item[columnKey];
        if (!value || normalize(value) === "undefined") return;

        // Conta oportunidades válidas (Ganhou ou Perdeu) para saber o total trabalhado
        if (isWorkableSaleStatus(item)) {
            totalByGroup[value] = (totalByGroup[value] || 0) + 1;
        }

        // Conta conversões puras (Apenas Ganhos)
        const isWon = STATUS.won.includes(normalize(item[COLUMN_MAP.status]));
        if (isWon) {
            winsByGroup[value] = (winsByGroup[value] || 0) + 1;
        }
    });

    const efficiencyEntries = [];

    Object.keys(totalByGroup).forEach(key => {
        const total = totalByGroup[key] || 0;
        const wins = winsByGroup[key] || 0;

        // Regra de segurança: precisa ter o mínimo de vendas exigido
        if (wins >= minWinsRequired && total > 0) {
            const rate = ((wins / total) * 100).toFixed(1);
            // Guarda [Nome, Taxa(%), TotalDeVendas]
            efficiencyEntries.push([key, parseFloat(rate), wins]);
        }
    });

    // Ordenação Inteligente: 
    // 1º Quem tem maior % de conversão.
    // 2º Se a % for igual, ganha quem fez mais vendas brutas.
    return efficiencyEntries.sort((a, b) => {
        if (b[1] === a[1]) {
            return b[2] - a[2]; // Desempate por volume
        }
        return b[1] - a[1]; // Ordenação principal por conversão
    });
}

function renderPodiumList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Estiliza o fundo do painel do pódio para o modo escuro premium
    const podiumWrapper = container.closest('.bg-green-500') || container;
    if (podiumWrapper) {
        podiumWrapper.className = "bg-slate-900 rounded-xl p-4 shadow-xl border border-green-800 transition-all duration-300";
    }

    // 2. FORÇA O CONTAINER A SER FLEX ROW (Cards lado a lado)
    // Adicionado 'flex flex-row flex-wrap md:flex-nowrap gap-4' para alinhar em linha e ficar responsivo
    container.className = "flex flex-row flex-wrap md:flex-nowrap gap-4 w-full justify-between items-center";

    container.innerHTML = "";

    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "text-xs text-slate-400 italic p-2 w-full text-center";
        empty.textContent = "Sem dados suficientes para este período.";
        container.appendChild(empty);
        return;
    }

    // 3. Renderiza os cartões dentro do fluxo flex-row
    items.forEach((item) => {
        const card = document.createElement("div");
        const rank = document.createElement("div");
        const content = document.createElement("div");
        const title = document.createElement("p");
        const label = document.createElement("p");
        const value = document.createElement("p");

        // Layout do Card - Adicionado 'flex-1' para que os 3 dividam o espaço da linha igualmente
        card.className = "bg-slate-800/50 backdrop-blur-sm border border-green-700/50 rounded-lg p-3 flex flex-row gap-3 items-center min-w-[200px] flex-1 shadow-sm transition-all duration-200 hover:border-green-600 hover:bg-green-950";

        // Badge do 1º Lugar - Medalha Dourada
        rank.className = "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/10 uppercase ring-2 ring-amber-400/20";

        content.className = "min-w-0 flex-1";

        // Textos internos
        title.className = "text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1";
        label.className = "text-[15px] font-bold text-white truncate leading-tight tracking-tight mb-0.5";
        value.className = "text-xs font-semibold text-orange-400 leading-none flex items-center gap-1";

        rank.textContent = "1º";
        title.textContent = item.title;
        label.textContent = item.label;
        value.textContent = `🏆 ${item.value} ${item.unit}`;

        content.appendChild(title);
        content.appendChild(label);
        content.appendChild(value);

        card.appendChild(rank);
        card.appendChild(content);
        container.appendChild(card);
    });
}

function openProspectList(type) {
    const rows = getRowsByDrilldownType(type);
    openProspectListForRows(DRILLDOWN_TITLES[type] || "Prospects", rows);
}

function openProspectListForRows(modalTitle, rows, options = {}) {
    const modal = document.getElementById("prospectModal");
    const title = document.getElementById("prospectModalTitle");
    const count = document.getElementById("prospectModalCount");

    if (!modal) return;

    title.textContent = modalTitle || "Prospects";
    count.textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;

    renderProspectTable(rows, options);
    modal.classList.remove("hidden");
}

function closeProspectList() {
    const modal = document.getElementById("prospectModal");
    if (modal) modal.classList.add("hidden");
}

function sanitizeSellerFieldsForModal(rows) {
    return rows.map(row => {
        const normalizedRow = { ...row };
        const resolvedSeller = getSellerValue(normalizedRow);

        if (resolvedSeller) {
            normalizedRow[COLUMN_MAP.vendedor] = resolvedSeller;
        }

        Object.keys(normalizedRow).forEach(key => {
            const lowerKey = normalize(key);
            if (lowerKey.includes("vendedor") && normalize(key) !== normalize(COLUMN_MAP.vendedor)) {
                delete normalizedRow[key];
            }
        });

        return normalizedRow;
    });
}

function renderProspectTable(rows, options = {}) {
    const header = document.getElementById("prospectListHeader");
    const body = document.getElementById("prospectListBody");
    const empty = document.getElementById("prospectModalEmpty");
    const modalTitleElement = document.getElementById("prospectModalTitle");

    if (!header || !body || !empty) return;

    const displayRows = sanitizeSellerFieldsForModal(rows);

    header.innerHTML = "";
    body.innerHTML = "";
    empty.classList.toggle("hidden", displayRows.length > 0);

    const currentTitle = modalTitleElement ? modalTitleElement.textContent.toLowerCase() : "";
    const hiddenColumns = [...(options.hiddenColumns || [])];

    const allWon = displayRows.length > 0 && displayRows.every(item => isWon(item));
    if (allWon) {
        hiddenColumns.push(COLUMN_MAP.motivoPerda);
        hiddenColumns.push("Motivo");
        hiddenColumns.push("Motivo de Perda");
    }

    if (currentTitle.includes("venc")) {
        hiddenColumns.push(COLUMN_MAP.motivoPerda);
        hiddenColumns.push("Motivo");
        hiddenColumns.push("Motivo de Perda");
    }

    if (currentTitle.includes("perd")) {
        hiddenColumns.push(COLUMN_MAP.plano);
        hiddenColumns.push("Plano");
        hiddenColumns.push("Plano de Venda");
    }

    if (currentTitle.includes("venc") || currentTitle.includes("perd") || currentTitle.includes("andamento") || currentTitle.includes("viabil")) {
        hiddenColumns.push(COLUMN_MAP.status);
        hiddenColumns.push("Status");
        hiddenColumns.push(COLUMN_MAP.contrato);
        hiddenColumns.push("Contrato Gerado");
        hiddenColumns.push("Contrato");
    }

    if (currentTitle.includes("prospect") || currentTitle.includes("andamento") || currentTitle.includes("viabil") || currentTitle.includes("perd")) {
        hiddenColumns.push(COLUMN_MAP.contrato);
        hiddenColumns.push("Contrato Gerado");
        hiddenColumns.push("Contrato");
    }

    hiddenColumns.push("Vendedor Contrato");
    hiddenColumns.push("Vendedor do contrato");
    hiddenColumns.push("Vendedor contrato");
    hiddenColumns.push("Vendedor de contrato");
    hiddenColumns.push("Vendedor Prospect");
    hiddenColumns.push("Vendedor prospect");
    hiddenColumns.push("Vendedor do prospect");
    hiddenColumns.push("Vendedor Comercial");
    hiddenColumns.push("Vendedor comercial");
    hiddenColumns.push("Consultor");

    const columns = getListColumns(displayRows).filter(column => {
        const originalKey = column;
        const visualLabel = getColumnLabel(column);

        return !hiddenColumns.some(hiddenColumn =>
            normalize(hiddenColumn) === normalize(originalKey) ||
            normalize(hiddenColumn) === normalize(visualLabel)
        );
    });

    columns.forEach(column => {
        const cell = document.createElement("th");
        cell.className = "p-4 text-left text-white whitespace-normal";
        cell.textContent = getColumnLabel(column);
        header.appendChild(cell);
    });

    displayRows.forEach(row => {
        const line = document.createElement("tr");
        line.className = "hover:bg-orange-300";

        columns.forEach(column => {
            const cell = document.createElement("td");
            cell.className = "p-2 text-white border border-yellow-500";
            cell.textContent = formatListValue(column, row[column]);
            line.appendChild(cell);
        });

        body.appendChild(line);
    });
}

function getRowsByDrilldownType(type) {
    const salesRows = (currentFilteredData || []).filter(Boolean);
    const prospectRows = (currentProspectFilteredData || []).filter(Boolean);

    // Prospects-related drilldowns should use the registration-based dataset
    if (type === "prospects") return prospectRows;
    if (type === "inProgress") return prospectRows.filter(item => STATUS.inProgress.includes(normalize(item?.[COLUMN_MAP.status])));
    if (type === "lost") return prospectRows.filter(item => STATUS.lost.includes(normalize(item?.[COLUMN_MAP.status])));
    if (type === "noViability") return prospectRows.filter(item => STATUS.noViability.includes(normalize(item?.[COLUMN_MAP.status])));

    // Sales/activation-related drilldowns use the sales/activation dataset
    if (type === "won") return getUniqueWonRows(salesRows);
    if (type === "installationPaid") return getUniqueWonRows(salesRows).filter(item => !isFreeInstallation(item));
    if (type === "installationFree") return getUniqueWonRows(salesRows).filter(item => isFreeInstallation(item));

    return [];
}

function getWinDedupKey(item) {
    const candidates = [
        item?.[COLUMN_MAP.id],
        item?.["ID Prospect"],
        item?.["ID do prospect"],
        item?.[COLUMN_MAP.contrato],
        item?.["Contrato Gerado"],
        item?.Contrato,
        item?.["Razão"],
        item?.Razao,
        item?.["Nome do cliente"],
        item?.Cliente,
        item?.[COLUMN_MAP.vendedor]
    ]

    const firstTruthy = candidates
        .map(value => normalize(String(value || "")))
        .find(value => value && value !== "undefined" && value !== "null")

    if (firstTruthy) return firstTruthy

    return JSON.stringify({
        status: item?.[COLUMN_MAP.status],
        contrato: item?.[COLUMN_MAP.contrato],
        valor: item?.[COLUMN_MAP.valorContrato],
        vendedor: getSellerValue(item)
    })
}

function getUniqueWonRows(rows) {
    const unique = new Map()

    rows.filter(isWon).forEach(item => {
        const key = getWinDedupKey(item)
        if (!unique.has(key)) {
            unique.set(key, item)
        }
    })

    return Array.from(unique.values())
}

function isWon(item) {
    // A contagem correta soma Vencemos + contrato ativo e elimina IDs repetidos entre as planilhas.
    return isRealWonSale(item, COLUMN_MAP)
}

function isWorkableSaleStatus(item) {
    // Uma oportunidade é considerada trabalhada se ela foi concluída (isWon) ou se foi perdida
    const status = normalize(item[COLUMN_MAP.status]);
    const isLostStatus = STATUS.lost && STATUS.lost.includes(status);

    return isWon(item) || isLostStatus;
}

function getRankingEntries(grouped, limit) {
    return Object.entries(grouped)
        .filter(([label, value]) =>
            label &&
            normalize(label) !== "undefined" &&
            Number(value) > 0
        )
        .slice(0, limit)
}

function isFreeInstallation(item) {
    return parseCurrencyNumber(item[COLUMN_MAP.taxaAtivacao]) <= 0;
}

function getListColumns(rows) {
    if (!rows.length) {
        return [
            COLUMN_MAP.status, COLUMN_MAP.vendedor, COLUMN_MAP.plano,
            COLUMN_MAP.canal, COLUMN_MAP.campanha, COLUMN_MAP.data
        ];
    }

    const availableColumns = Object.keys(rows[0]);
    const selectedColumns = LIST_COLUMN_CANDIDATES
        .map(candidate => availableColumns.find(column => normalize(column) === normalize(candidate)))
        .filter(Boolean)
        .filter((column, index, columns) => columns.indexOf(column) === index);

    return selectedColumns.length ? selectedColumns : availableColumns.slice(0, 8);
}

function getColumnLabel(column) {
    if (column === COLUMN_MAP.motivoPerda) return "Motivo";
    return column;
}

function formatListValue(column, value) {
    if (column === COLUMN_MAP.vendedor) return resolveSellerDisplayName(value) || value || "-";
    return value || "-";
}

function copyPhoneToClipboard(phone) {
    if (!phone) return;

    // Copia para o clipboard
    navigator.clipboard.writeText(phone).then(() => {
        alert("Telefone copiado: " + phone);

        // Abre o WhatsApp Web automaticamente (formato internacional padrão)
        // Remove caracteres não numéricos
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}`, '_blank');
    });
}

/* 4. EVENT LISTENERS DO SISTEMA */
document.getElementById("closeProspectModal").addEventListener("click", closeProspectList);

document.getElementById("prospectModal").addEventListener("click", event => {
    if (event.target.id === "prospectModal") closeProspectList();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeProspectList();
});
