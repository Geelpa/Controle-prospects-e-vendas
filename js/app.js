function processData(data) {
    currentFilteredData = data;

    const total = data.length

    // ALTERADO: Agora usa a nossa nova função isWon com critérios rígidos
    const won = data.filter(isWon).length;

    const lost = data.filter(item =>
        STATUS.lost.includes(normalize(item[COLUMN_MAP.status]))
    ).length

    const noViability = data.filter(item =>
        STATUS.noViability.includes(normalize(item[COLUMN_MAP.status]))
    ).length

    const inProgress = data.filter(item =>
        STATUS.inProgress.includes(normalize(item[COLUMN_MAP.status]))
    ).length

    const workableSales = data.filter(item =>
        isWorkableSaleStatus(item)
    ).length

    const conversion =
        workableSales > 0
            ? ((won / workableSales) * 100).toFixed(1)
            : 0

    // ALTERADO: Pega os dados brutos filtrando apenas vendas reais confirmadas
    const wonOnly = data.filter(isWon);

    let totalRevenue = 0

    wonOnly.forEach(item => {
        const planId = item[COLUMN_MAP.plano]
        let price = 0

        if (PLAN_MAP[planId]) {
            price = PLAN_MAP[planId].price
        } else {
            const foundPlan =
                Object.values(PLAN_MAP).find(plan =>
                    normalize(plan.name) ===
                    normalize(planId)
                )

            if (foundPlan) {
                price = foundPlan.price
            }
        }
        totalRevenue += price
    })

    const averageTicket =
        wonOnly.length > 0
            ? totalRevenue / wonOnly.length
            : 0

    updateKPIs({
        total,
        won,
        lost,
        noViability,
        inProgress,
        conversion,
        averageTicket:
            averageTicket.toLocaleString(
                "pt-BR",
                {
                    style: "currency",
                    currency: "BRL"
                }
            )
    })

    // CRUCIAL: Passamos os dados atuais (filtrados por mês/ano/etc) para o pódio controlar internamente
    renderPodiums(data)

    // Gráficos continuam normais
    createChannelsChart(data)
    createCampaignsChart(data)
    createLossReasonsChart(data)
    createSalesPerDayChart(data)
    createSellersChart(data)
    createInstallationChart(data)
    createPlansChart(data)
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

// function getPodiumRankingGroups(currentData) {
//     // Pega apenas as vendas ganhas para contar o volume de sucesso
//     const wonOnlyNormal = currentData.filter(item =>
//         STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
//     );

//     const wonOnlySellers = currentData.filter(item =>
//         STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
//     );

//     // Função de segurança para garantir que exiba "Leandro" e não "74"
//     const formatName = (mapName, key) => {
//         if (typeof mapName !== 'undefined' && mapName[key]) return mapName[key];
//         return key;
//     };

//     // A ordem aqui dita as colunas: 1º Vendedor (Esq) -> 2º Canal (Meio) -> 3º Campanha (Dir)
//     return [
//         {
//             title: "Vendedor",
//             unit: "vendas",
//             entries: getRankingEntries(groupBy(wonOnlySellers, COLUMN_MAP.vendedor), 8)
//                 .map(e => [formatName(typeof SELLER_MAP !== 'undefined' ? SELLER_MAP : {}, e[0]), e[1]])
//         },
//         {
//             title: "Canal de Venda",
//             unit: "vendas",
//             entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.canal), 8)
//                 .map(e => [formatName(typeof CHANNEL_MAP !== 'undefined' ? CHANNEL_MAP : {}, e[0]), e[1]])
//         },
//         {
//             title: "Campanha",
//             unit: "vendas",
//             entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.campanha), 8)
//                 .map(e => [formatName(typeof CAMPAIGN_MAP !== 'undefined' ? CAMPAIGN_MAP : {}, e[0]), e[1]])
//         }
//     ];
// }

function getPodiumRankingGroups(currentData) {
    // ALTERADO: Filtra os dados de forma limpa usando a inteligência do isWon
    const wonOnlyNormal = currentData.filter(isWon);
    const wonOnlySellers = currentData.filter(isWon);

    const formatName = (mapName, key) => {
        if (typeof mapName !== 'undefined' && mapName[key]) return mapName[key];
        return key;
    };

    return [
        {
            title: "Vendedor",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlySellers, COLUMN_MAP.vendedor), 8)
                .map(e => [formatName(typeof SELLER_MAP !== 'undefined' ? SELLER_MAP : {}, e[0]), e[1]])
        },
        {
            title: "Canal de Venda",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.canal), 8)
                .map(e => [formatName(typeof CHANNEL_MAP !== 'undefined' ? CHANNEL_MAP : {}, e[0]), e[1]])
        },
        {
            title: "Campanha",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnlyNormal, COLUMN_MAP.campanha), 8)
                .map(e => [formatName(typeof CAMPAIGN_MAP !== 'undefined' ? CAMPAIGN_MAP : {}, e[0]), e[1]])
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
    const hasWonStatus = STATUS.won.includes(normalize(item[COLUMN_MAP.status]));

    const contractStatus = item[COLUMN_MAP.contrato];
    const isContractActive = contractStatus && normalize(contractStatus) === normalize("ativo");

    const planSelected = item[COLUMN_MAP.plano];
    const hasPlan = planSelected &&
        normalize(planSelected) !== "" &&
        normalize(planSelected) !== "undefined" &&
        normalize(planSelected) !== "null";

    return hasWonStatus && isContractActive && hasPlan;
}


function isWorkableSaleStatus(item) {
    const status = normalize(item[COLUMN_MAP.status]);
    return STATUS.won.includes(status) || STATUS.lost.includes(status);
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
    const campaignId = item[COLUMN_MAP.campanha];
    const campaignName = CAMPAIGN_MAP[campaignId] || "";
    const normalizedCampaignName = normalize(campaignName);
    const palavrasFree = ["isenta", "troca", "negociação", "não preenchido"];

    return palavrasFree.some(palavra => normalizedCampaignName.includes(palavra));
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
    if (column === COLUMN_MAP.plano) return PLAN_MAP[value]?.name || value || "-";
    if (column === COLUMN_MAP.canal) return CHANNEL_MAP[value] || value || "-";
    if (column === COLUMN_MAP.campanha) return CAMPAIGN_MAP[value] || value || "-";
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
document.querySelectorAll("[data-drilldown]").forEach(card => {
    card.addEventListener("click", () => openProspectList(card.dataset.drilldown));
    card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openProspectList(card.dataset.drilldown);
    });
});

document.getElementById("closeProspectModal").addEventListener("click", closeProspectList);

document.getElementById("prospectModal").addEventListener("click", event => {
    if (event.target.id === "prospectModal") closeProspectList();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeProspectList();
});