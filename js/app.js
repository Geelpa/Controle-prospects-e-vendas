function processData(data) {
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
    const isNewProspect = (item) => {
        const plano = normalize(item[COLUMN_MAP.plano] || "");
        const campanha = normalize(item[COLUMN_MAP.campanha] || "");
        const canal = normalize(item[COLUMN_MAP.canal] || "");
        const invalidTerms = ["adicional"];

        return !invalidTerms.some(term =>
            plano.includes(term) || campanha.includes(term) || canal.includes(term)
        );
    };

    // --- BLOCO 1: CONVERSÃO E QUANTIDADES COMERCIAIS (VERSÃO DE ALTA PRECISÃO - 124) ---

    const prospectsData = data.filter(isNewProspect);
    currentFilteredData = prospectsData;
    const totalProspects = prospectsData.length;

    // A contagem usa a inteligência de dupla checagem direta do arquivo
    const won = prospectsData.filter(isWon).length;

    const lost = prospectsData.filter(item =>
        !isWon(item) && STATUS.lost.includes(normalize(item[COLUMN_MAP.status]))
    ).length;

    const noViability = prospectsData.filter(item =>
        !isWon(item) && STATUS.noViability.includes(normalize(item[COLUMN_MAP.status]))
    ).length;

    const inProgress = prospectsData.filter(item =>
        !isWon(item) && STATUS.inProgress.includes(normalize(item[COLUMN_MAP.status]))
    ).length;

    const workableSales = prospectsData.filter(isWorkableSaleStatus).length;
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

    const wonOnly = data.filter(isWon);

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

    // === FUNÇÃO DE AUDITORIA DE VENDEDOR PARA GRÁFICOS E PÓDIOS ===
    // Retorna o Vendedor do Contrato se existir, caso contrário mantém o do Prospect.
    // Isso evita usar { ...item } e quebrar a leitura da planilha!
    const getSellersName = (item) => {
        const sellerFromContract = item[COLUMN_MAP.vendedorContrato];
        if (sellerFromContract && String(sellerFromContract).trim() !== "" && normalize(sellerFromContract) !== "undefined") {
            return sellerFromContract;
        }
        return item[COLUMN_MAP.vendedor];
    };

    // Criamos uma função de mapeamento exclusiva e segura para os gráficos que dependem do vendedor
    const chartDataWithCorrectSellers = prospectsData.map(item => {
        // Criamos um proxy leve, apenas substituindo a propriedade de texto do vendedor com segurança
        return {
            ...item,
            [COLUMN_MAP.vendedor]: getSellersName(item)
        };
    });

    // Alimentamos os gráficos específicos de Vendedor e Canal com os nomes auditados
    if (typeof createSellersChart === "function") createSellersChart(chartDataWithCorrectSellers);
    if (typeof createChannelsChart === "function") createChannelsChart(chartDataWithCorrectSellers);

    // Todos os gráficos agora usam somente os prospects válidos filtrados para manter os KPIs e drilldowns consistentes.
    if (typeof createCampaignsChart === "function") createCampaignsChart(prospectsData);
    if (typeof createSalesPerDayChart === "function") createSalesPerDayChart(prospectsData);
    if (typeof createLossReasonsChart === "function") createLossReasonsChart(prospectsData);
    if (typeof createInstallationChart === "function") createInstallationChart(prospectsData);
    if (typeof createPlansChart === "function") createPlansChart(prospectsData);
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
    // ALTERADO: Filtra os dados de forma limpa usando a inteligência do isWon
    const wonOnlyNormal = currentData.filter(isWon);
    const wonOnlySellers = currentData.filter(isWon);

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
        value.className = "text-xs font-semibold text-emerald-400 leading-none flex items-center gap-1";

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

function renderProspectTable(rows, options = {}) {
    const header = document.getElementById("prospectListHeader");
    const body = document.getElementById("prospectListBody");
    const empty = document.getElementById("prospectModalEmpty");
    const modalTitleElement = document.getElementById("prospectModalTitle");

    if (!header || !body || !empty) return;

    header.innerHTML = "";
    body.innerHTML = "";
    empty.classList.toggle("hidden", rows.length > 0);

    const currentTitle = modalTitleElement ? modalTitleElement.textContent.toLowerCase() : "";
    const hiddenColumns = options.hiddenColumns || [];

    // REGRA SIMPLIFICADA 1: Se o título tem "venc", esconde o Motivo de Perda
    if (currentTitle.includes("venc")) {
        hiddenColumns.push(COLUMN_MAP.motivoPerda);
        hiddenColumns.push("Motivo");
        hiddenColumns.push("Motivo de Perda");
    }

    // REGRA SIMPLIFICADA 2: Se o título tem "perd", esconde o Plano de Venda
    if (currentTitle.includes("perd")) {
        hiddenColumns.push(COLUMN_MAP.plano);
        hiddenColumns.push("Plano");
        hiddenColumns.push("Plano de Venda");
    }

    // REGRA EXTRA: Esconde o Status se o modal já for de um status segmentado
    if (currentTitle.includes("venc") || currentTitle.includes("perd") || currentTitle.includes("andamento") || currentTitle.includes("viabil")) {
        hiddenColumns.push(COLUMN_MAP.status);
        hiddenColumns.push("Status");
    }

    // Filtra o array final de colunas baseando-se na chave e no label visual
    const columns = getListColumns(rows).filter(column => {
        const originalKey = column;
        const visualLabel = getColumnLabel(column);

        return !hiddenColumns.some(hiddenColumn =>
            normalize(hiddenColumn) === normalize(originalKey) ||
            normalize(hiddenColumn) === normalize(visualLabel)
        );
    });

    // Cria as tags th do Cabeçalho
    columns.forEach(column => {
        const cell = document.createElement("th");
        cell.className = "p-4 text-left text-slate-800 whitespace-normal";
        cell.textContent = getColumnLabel(column);
        header.appendChild(cell);
    });

    // Cria as tags td das Linhas
    rows.forEach(row => {
        const line = document.createElement("tr");
        line.className = "hover:bg-slate-50";

        columns.forEach(column => {
            const cell = document.createElement("td");
            cell.className = "p-2 text-slate-600 border border-slate-300";
            cell.textContent = formatListValue(column, row[column]);
            line.appendChild(cell);
        });

        body.appendChild(line);
    });
}

function getRowsByDrilldownType(type) {
    const rows = currentFilteredData || [];

    if (type === "prospects") return rows;
    if (type === "inProgress") return rows.filter(item => STATUS.inProgress.includes(normalize(item[COLUMN_MAP.status])));
    if (type === "won") return rows.filter(isWon);
    if (type === "lost") return rows.filter(item => STATUS.lost.includes(normalize(item[COLUMN_MAP.status])));
    if (type === "noViability") return rows.filter(item => STATUS.noViability.includes(normalize(item[COLUMN_MAP.status])));
    if (type === "installationPaid") return rows.filter(item => isWon(item) && !isFreeInstallation(item));
    if (type === "installationFree") return rows.filter(item => isWon(item) && isFreeInstallation(item));

    return [];
}

function isWon(item) {
    // 1. Primeira Métrica: O comercial marcou como ganho/vencemos?
    const hasWonStatus = STATUS.won && STATUS.won.includes(normalize(item[COLUMN_MAP.status]));

    // 2. Segunda Métrica (Auditoria): Existe um contrato preenchido e valor maior que zero?
    const contractField = item[COLUMN_MAP.contrato];
    const contractClean = String(contractField || "").trim().toLowerCase();

    const hasContractEvidencie = contractClean !== "" &&
        contractClean !== "-" &&
        contractClean !== "nao" &&
        contractClean !== "não" &&
        contractClean !== "null" &&
        contractClean !== "undefined";

    // Usamos a função parseNumber (que já está declarada no topo do processData)
    // Se a função global for necessária aqui, usamos o tratamento seguro:
    let rawPrice = item[COLUMN_MAP.valorContrato];
    let cleanPrice = String(rawPrice || "").replace(/[R$\s]/g, '').replace(',', '.').trim();
    const hasPrice = parseFloat(cleanPrice) > 0;

    const hasFinancialProof = hasContractEvidencie && hasPrice;

    // REGRA DE OURO: Se passou em QUALQUER uma das duas métricas, a venda está confirmada!
    return hasWonStatus || hasFinancialProof;
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
    if (column === COLUMN_MAP.vendedor) return SELLER_MAP[value] || value || "-";
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