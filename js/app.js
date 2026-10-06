function processData(prospectData, salesData) {
    // 1. FUNÇÃO AUXILIAR: Converte valores da planilha tratando formatos
    const parseNumber = (value) => {
        return parseFlexibleNumber(value);
    };

    salesData = (salesData || []).map(applyBusinessRules);
    currentDashboardMetrics = buildDashboardMetrics(prospectData, salesData);

    // --- BLOCO 1: CONVERSÃO E QUANTIDADES COMERCIAIS (VERSÃO DE ALTA PRECISÃO - 124) ---

    const prospectsData = currentDashboardMetrics.prospects;
    currentFilteredData = currentDashboardMetrics.salesRows;
    currentProspectFilteredData = prospectsData;
    const currentProspectData = prospectsData;
    const totalProspects = prospectsData.length;

    // As vendas e ativações devem considerar também adicionais e troca de titularidade,
    // porque ambos podem gerar contrato novo mesmo sem serem "prospect novo".
    const wonRows = currentDashboardMetrics.wonRows;
    const won = wonRows.length;
    const conversionWonRows = wonRows.filter(item =>
        !isAdditionalPlan(item, COLUMN_MAP) &&
        !isOwnershipTransferChannel(item)
    );
    const alreadyClients = getUniqueWonRows(
        (salesData || []).filter(item => isAdditionalPlan(item, COLUMN_MAP))
    ).length;
    const salesPerformanceRows = wonRows;

    // PERDEMOS: apenas status 'perdemos'
    const lost = currentDashboardMetrics.prospectStatusRows.lost.length;

    // SEM VIABILIDADE: apenas status 'sem viabilidade'
    const noViability = currentDashboardMetrics.prospectStatusRows.noViability.length;

    const contractStatusRows = salesData || [];
    const countContractCategory = category => contractStatusRows.filter(item =>
        getContractStatusCategory(item) === category
    ).length;
    const inactive = contractStatusRows.filter(isInactiveContract).length;
    const withdrawn = countContractCategory("withdrawn");
    const cancelled = countContractCategory("cancelled");

    // EM ANDAMENTO: todos os prospects com status diferentes de vencemos, perdemos, abortamos ou sem viabilidade
    const inProgress = currentDashboardMetrics.prospectStatusRows.inProgress.length;

    // Conversão: compara apenas oportunidades concluídas de aquisição (ganhas ou perdidas).
    // Planos adicionais e trocas de titularidade não são oportunidades novas.
    const conversionBase = conversionWonRows.length + lost;

    const conversion =
        conversionBase > 0
            ? ((conversionWonRows.length / conversionBase) * 100).toFixed(1)
            : 0;


    // --- BLOCO 2: FINANCEIRO (INTEGRALMENTE RESTAURADO) ---
    // Inclui vendas de planos adicionais como receita de contrato, sem somá-los aos prospects.
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
        alreadyClients,
        inactive,
        withdrawn,
        cancelled,
        conversion,
        averageTicket,
        totalTaxPaid: formattedTaxRevenue
    });
    updateMonthlyGoal()

    // Executa a auditoria consolidada para ajudar a diagnosticar diferenças com o IXC
    try {
        logDashboardAudit(salesData || [], prospectsData, isNewProspect, currentDashboardMetrics);
    } catch (e) { /** não quebrar a execução */ }
     // === FUNÇÃO DE AUDITORIA DE VENDEDOR PARA GRÁFICOS E PÓDIOS ===
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

    updateTopRanking(currentDashboardMetrics, chartDataWithCorrectSellers);

    // Gráficos de desempenho devem seguir a base real de vendas e manter status perdidos/andamento
    // para comparação; só o canal de venda exclui Troca de Titularidade.
    if (typeof createSellersChart === "function") createSellersChart(chartDataWithCorrectSellers);
    if (typeof createPlansChart === "function") createPlansChart(chartDataWithCorrectSellers);
    if (typeof createInstallationChart === "function") createInstallationChart(chartDataWithCorrectSellers);
    if (typeof createSalesPerDayChart === "function") {
        const resultChartRows = [
            ...wonRows,
            ...currentDashboardMetrics.prospectStatusRows.lost,
            ...currentDashboardMetrics.prospectStatusRows.noViability
        ];

        createSalesPerDayChart(resultChartRows, prospectsData, currentDashboardMetrics);
    }

    // Gráficos de funil e comparação de status continuam na base completa filtrada (vendas/ativação).
    if (typeof createChannelsChart === "function") createChannelsChart(salesData || []);
    if (typeof createCampaignsChart === "function") createCampaignsChart(salesData || []);
    if (typeof createLossReasonsChart === "function") createLossReasonsChart(salesData || []);
}

document.querySelectorAll("[data-page-tab]").forEach(button => {
    button.addEventListener("click", () => {
        const showGoal = button.dataset.pageTab === "goal"
        document.getElementById("dashboardView")?.classList.toggle("hidden", showGoal)
        document.getElementById("goalContent")?.classList.toggle("hidden", !showGoal)

        document.querySelectorAll("[data-page-tab]").forEach(tab => {
            const isActive = tab === button
            tab.classList.toggle("is-active", isActive)
            tab.setAttribute("aria-selected", String(isActive))
        })
    })
})
updateMonthlyGoal()

function updateMonthlyGoal() {
    const title = document.getElementById("goalMonthTitle")
    if (!title) return

    const targetDate = new Date()
    targetDate.setDate(1)
    targetDate.setMonth(targetDate.getMonth() + 1)

    const formatCount = value => Math.ceil(value || 0).toLocaleString("pt-BR")
    const formatMonth = date => new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric"
    }).format(date)
    const targetLabel = formatMonth(targetDate)
    title.textContent = `Meta de ${targetLabel}`

    const setText = (id, value) => {
        const element = document.getElementById(id)
        if (element) element.textContent = value
    }

    const selectedSeller = normalize(document.getElementById("sellerFilter")?.value || "all")
    const query = document.getElementById("globalSearch")?.value || ""
    const matchesLeadFilters = item => {
        if (query && !matchesGlobalSearch(item, query)) return false
        if (selectedSeller === "all") return true

        const seller = getProspectSellerValue(item) || getSellerValue(item)
        return normalize(resolveSellerDisplayName(seller)) === selectedSeller
    }

    const seenProspects = new Set()
    const prospectRows = (rawData || []).filter(item => {
        if (!isNewProspect(item, COLUMN_MAP) || !matchesLeadFilters(item)) return false

        const prospectId = typeof getProspectId === "function" ? getProspectId(item) : ""
        if (!prospectId) return true
        if (seenProspects.has(prospectId)) return false
        seenProspects.add(prospectId)
        return true
    })

    const monthlyLeadCounts = new Map()
    prospectRows.forEach(item => {
        const date = extractRegistrationDate(item)
        if (!date) return

        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        monthlyLeadCounts.set(key, (monthlyLeadCounts.get(key) || 0) + 1)
    })

    const fixedTarget = document.getElementById("goalFixedTarget")
    const fixedFormula = document.getElementById("goalFixedFormula")
    const dailyTarget = 11
    let businessDays = 0
    const daysInTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInTargetMonth; day++) {
        const weekday = new Date(targetDate.getFullYear(), targetDate.getMonth(), day).getDay()
        if (weekday !== 0 && weekday !== 6) businessDays++
    }

    const monthlyLeadAverage = Array.from(monthlyLeadCounts.values()).reduce((sum, count) => sum + count, 0) / Math.max(monthlyLeadCounts.size, 1)
    const activationMonthlyCounts = new Map()
    const activationRows = getUniqueWonRows((rawData || []).filter(item => {
        if (!isWon(item)) return false
        if (query && !matchesGlobalSearch(item, query)) return false
        if (selectedSeller !== "all") {
            const seller = getContractSellerValue(item) || getSellerValue(item)
            return normalize(resolveSellerDisplayName(seller)) === selectedSeller
        }
        return true
    }))
    activationRows.forEach(item => {
        const date = extractActivationDate(item)
        if (!date) return
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        activationMonthlyCounts.set(key, (activationMonthlyCounts.get(key) || 0) + 1)
    })
    const monthlyActivationAverage = Array.from(activationMonthlyCounts.values()).reduce((sum, count) => sum + count, 0) / Math.max(activationMonthlyCounts.size, 1)

    const fixedMinimumMonthlyGoal = businessDays * dailyTarget
    const activationDynamicInfo = (() => {
        if (!activationMonthlyCounts.size) return { target: fixedMinimumMonthlyGoal, formula: `${businessDays} dias úteis × ${formatCount(dailyTarget)} por dia` }

        const getMonthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const currentMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)
        const lastCompletedMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1)
        const referenceDate = new Date(lastCompletedMonthDate.getFullYear(), lastCompletedMonthDate.getMonth() - 12, 1)
        const resolvedReferenceDate = (() => {
            const referenceKey = getMonthKey(referenceDate)
            if (activationMonthlyCounts.has(referenceKey)) return referenceDate
            const availableDates = Array.from(activationMonthlyCounts.keys())
                .map(key => {
                    const [year, month] = key.split("-").map(Number)
                    return new Date(year, month - 1, 1)
                })
                .sort((a, b) => a - b)
            const oldestPastDate = availableDates.filter(date => date <= referenceDate)[0]
            return oldestPastDate || availableDates[0] || referenceDate
        })()
        const completedMonthActivations = activationMonthlyCounts.get(getMonthKey(lastCompletedMonthDate)) || 0
        const referenceMonthActivations = activationMonthlyCounts.get(getMonthKey(resolvedReferenceDate)) || 0
        const historicalActivationGoal = Math.max(0, Math.ceil(completedMonthActivations - referenceMonthActivations * 0.1))
        const target = Math.max(fixedMinimumMonthlyGoal, historicalActivationGoal)
        const formula = historicalActivationGoal >= fixedMinimumMonthlyGoal
            ? `${formatCount(completedMonthActivations)} ativações − 10% de ${formatCount(referenceMonthActivations)} = ${formatCount(target)}`
            : `${businessDays} dias úteis × ${formatCount(dailyTarget)} por dia = ${formatCount(target)}`
        return { target, formula }
    })()

    if (fixedTarget) fixedTarget.textContent = formatCount(fixedMinimumMonthlyGoal)
    if (fixedFormula) fixedFormula.textContent = `${businessDays} dias úteis × ${formatCount(dailyTarget)} por dia`
    setText("goalBusinessDays", `Dias úteis: ${businessDays} (sem descontar feriados)`)
    setText("leadAverageTarget", formatCount(fixedMinimumMonthlyGoal))
    setText("leadAverageActual", formatCount(monthlyLeadAverage))
    setText("leadAverageMeta", `${businessDays} dias úteis × ${formatCount(dailyTarget)}/dia`)
    setText("activationAverageTarget", formatCount(fixedMinimumMonthlyGoal))
    setText("activationAverageActual", formatCount(monthlyActivationAverage))
    setText("activationAverageMeta", `${businessDays} dias úteis × ${formatCount(dailyTarget)}/dia`)
    setText("activationFixedTarget", formatCount(fixedMinimumMonthlyGoal))
    setText("activationDynamicTarget", formatCount(activationDynamicInfo.target))
    setText("activationDynamicFormula", activationDynamicInfo.formula)
    setText("activationDynamicPeriods", `Base: ${formatMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1))} · Ref.: ${formatMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 14, 1))}`)

    const dynamicTarget = document.getElementById("goalDynamicTarget")
    const dynamicFormula = document.getElementById("goalDynamicFormula")
    const dynamicPeriods = document.getElementById("goalDynamicPeriods")
    const status = document.getElementById("goalStatus")

    if (!monthlyLeadCounts.size) {
        if (dynamicTarget) dynamicTarget.textContent = "Sem histórico"
        if (dynamicFormula) dynamicFormula.textContent = "A meta dinâmica será exibida quando houver leads com data de cadastro."
        if (dynamicPeriods) dynamicPeriods.textContent = "Mês-base: -- · Referência: --"
        if (status) status.textContent = "A meta fixa de Vencemos já está calculada; carregue uma base para calcular a meta de leads."
        setText("leadFixedTarget", "--")
        setText("leadDynamicTarget", "--")
        setText("leadDynamicFormula", "Sem histórico")
        setText("activationFixedTarget", "--")
        setText("activationDynamicTarget", "--")
        setText("activationDynamicFormula", "Sem histórico")
        return
    }

    const getMonthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const lastCompletedMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1)
    const referenceDate = new Date(lastCompletedMonthDate.getFullYear(), lastCompletedMonthDate.getMonth() - 12, 1)
    const resolvedReferenceDate = (() => {
        const referenceKey = getMonthKey(referenceDate)
        if (monthlyLeadCounts.has(referenceKey)) return referenceDate

        const availableDates = Array.from(monthlyLeadCounts.keys())
            .map(key => {
                const [year, month] = key.split("-").map(Number)
                return new Date(year, month - 1, 1)
            })
            .sort((a, b) => a - b)

        const oldestPastDate = availableDates.filter(date => date <= referenceDate)[0]
        return oldestPastDate || availableDates[0] || referenceDate
    })()
    const completedMonthLeads = monthlyLeadCounts.get(getMonthKey(lastCompletedMonthDate)) || 0
    const referenceMonthLeads = monthlyLeadCounts.get(getMonthKey(resolvedReferenceDate)) || 0
    const historicalLeadGoal = Math.max(0, Math.ceil(completedMonthLeads - referenceMonthLeads * 0.1))
    const minimumLeadGoal = businessDays * dailyTarget
    const leadGoal = Math.max(minimumLeadGoal, historicalLeadGoal)

    if (dynamicTarget) dynamicTarget.textContent = formatCount(leadGoal)
    if (dynamicFormula) dynamicFormula.textContent = historicalLeadGoal >= minimumLeadGoal
        ? `${formatCount(completedMonthLeads)} leads − 10% de ${formatCount(referenceMonthLeads)} leads = ${formatCount(leadGoal)}`
        : `${businessDays} dias úteis × ${formatCount(dailyTarget)} por dia = ${formatCount(leadGoal)}`
    if (dynamicPeriods) dynamicPeriods.textContent = `Mês-base (${formatMonth(lastCompletedMonthDate)}): ${formatCount(completedMonthLeads)} · Referência (${formatMonth(resolvedReferenceDate)}): ${formatCount(referenceMonthLeads)}`
    if (status) status.textContent = `Meta de leads para ${targetLabel}. Usa o último mês completo e aplica um piso de ${formatCount(dailyTarget)} prospects por dia útil.`

    setText("leadFixedTarget", formatCount(minimumLeadGoal))
    setText("leadDynamicTarget", formatCount(leadGoal))
    setText("leadDynamicFormula", dynamicFormula.textContent)
    setText("leadDynamicPeriods", dynamicPeriods.textContent)
    setText("activationFixedTarget", formatCount(fixedMinimumMonthlyGoal))
    setText("activationDynamicTarget", formatCount(activationDynamicInfo.target))
    setText("activationDynamicFormula", activationDynamicInfo.formula)
    setText("activationDynamicPeriods", `Base: ${formatMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1))} · Ref.: ${formatMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 14, 1))}`)
}

function buildDashboardMetrics(prospectData, salesData) {
    const prospects = (prospectData || []).filter(item => isNewProspect(item, COLUMN_MAP));
    const salesRows = salesData || [];
    const prospectStatusRows = {
        won: [],
        lost: [],
        noViability: [],
        inProgress: [],
        other: []
    };

    prospects.forEach(item => {
        prospectStatusRows[getProspectStatusCategory(item)].push(item);
    });

    const wonRows = getUniqueWonRows(salesRows);
    const rankingRows = [
        ...wonRows,
        ...getDeduplicatedChartRows(salesRows.filter(item => !isWon(item)))
    ].filter(item =>
        isWon(item) || isLossStatus(item) || isRankingContractPenalty(item)
    );

    return { prospects, salesRows, prospectStatusRows, wonRows, rankingRows };
}

function getRankingGroupLabel(item, columnName) {
    if (columnName === COLUMN_MAP.vendedor) {
        const contractSeller = getContractSellerValue(item);
        const seller = contractSeller || getSellerValue(item);
        return resolveSellerDisplayName(seller) || seller || "Sem vendedor";
    }

    return getChartDisplayValue(item, columnName) || `Sem ${columnName.toLowerCase()}`;
}

function getRankingMonthKey(item) {
    const date = isWon(item)
        ? extractActivationDate(item)
        : extractRegistrationDate(item);

    return date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : "";
}

function getRankingContractDurationMonths(item, referenceDate) {
    const activationDate = extractActivationDate(item);
    if (!activationDate) return 0;

    const endDate = [
        item?.[COLUMN_MAP.dataCancelamento],
        item?.[COLUMN_MAP.dataDesistencia]
    ].map(parseDateValue).find(Boolean) || referenceDate;
    if (!endDate || endDate < activationDate) return 0;

    return (endDate - activationDate) / (1000 * 60 * 60 * 24 * 30.4375);
}

function isRankingContractPenalty(item) {
    const contractStatus = normalize(String(item?.[COLUMN_MAP.statusContrato] || ""));
    return ["cancelled", "withdrawn"].includes(getContractStatusCategory(item)) ||
        STATUS.contractCancelled.includes(contractStatus) ||
        STATUS.contractWithdrawn.includes(contractStatus);
}

function isExcludedRankingPlan(label) {
    const normalizedLabel = String(label || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    return /\b(exclusiv[oa]s?|test(e|es|ando|ado)?|sem\s+plano|nenhum\s+plano|plano\s+nao\s+definido)\b/.test(normalizedLabel);
}

function getRankingGroupMetrics(rows, columnName, referenceDate = new Date(), includeActivationTax = false) {
    const grouped = new Map();

    rows.forEach(item => {
        if (!isWon(item) && !isLossStatus(item) && !isRankingContractPenalty(item)) return;

        const label = getRankingGroupLabel(item, columnName);
        if (columnName === COLUMN_MAP.plano && isExcludedRankingPlan(label)) return;

        const key = normalize(label);
        if (!key || key === "undefined") return;

        if (!grouped.has(key)) {
            grouped.set(key, {
                label,
                won: 0,
                lost: 0,
                revenue: 0,
                received: 0,
                activationTax: 0,
                totalCollected: 0,
                durationMonths: 0,
                durationCount: 0,
                cancelled: 0,
                months: new Set()
            });
        }

        const entry = grouped.get(key);
        const monthKey = getRankingMonthKey(item);
        if (monthKey) entry.months.add(monthKey);

        const durationMonths = getRankingContractDurationMonths(item, referenceDate);
        if (durationMonths > 0) {
            entry.durationMonths += durationMonths;
            entry.durationCount++;
        }

        if (isWon(item)) {
            entry.won++;
            entry.revenue += parseCurrencyNumber(item?.[COLUMN_MAP.valorContrato]);
            const received = parseCurrencyNumber(item?.[COLUMN_MAP.valorRecebido]);
            const activationTax = includeActivationTax
                ? Math.max(0, parseCurrencyNumber(item?.[COLUMN_MAP.taxaAtivacao]))
                : 0;
            entry.received += received;
            entry.activationTax += activationTax;
            entry.totalCollected += received + activationTax;
        } else if (isLostStatus(item)) {
            entry.lost++;
        } else if (isRankingContractPenalty(item)) {
            entry.cancelled++;
        }
    });

    return Array.from(grouped.values());
}

function getRankingConversion(won, lost, globalConversion) {
    const total = won + lost;
    if (!total) return 0;

    // Prior de cinco oportunidades para reduzir distorções de amostras pequenas.
    return ((won + globalConversion * 5) / (total + 5)) * 100;
}

function getRankingScore(entry, options) {
    const conversion = getRankingConversion(entry.won, entry.lost, options.globalConversion);
    const volume = options.maxWon ? entry.won / options.maxWon : 0;
    const consistency = options.totalMonths
        ? entry.months.size / options.totalMonths
        : 0;
    const cancellationRate = entry.won + entry.cancelled > 0
        ? entry.cancelled / (entry.won + entry.cancelled)
        : 0;
    const received = options.maxReceived ? entry.received / options.maxReceived : 0;

    if (options.type === "seller") {
        const revenue = options.maxRevenue ? entry.revenue / options.maxRevenue : 0;
        return conversion / 100 * 0.25 + volume * 0.35 + revenue * 0.15 + received * 0.05 + consistency * 0.1 - cancellationRate * 0.1;
    }

    if (options.type === "plan") {
        const averageReceived = entry.won ? entry.totalCollected / entry.won : 0;
        const totalCollected = options.maxReceived ? entry.totalCollected / options.maxReceived : 0;
        const receivedPerActivation = options.maxAverageReceived
            ? averageReceived / options.maxAverageReceived
            : 0;
        const averageDuration = entry.durationCount ? entry.durationMonths / entry.durationCount : 0;
        const durationScore = options.maxAverageDuration
            ? averageDuration / options.maxAverageDuration
            : 0;
        return conversion / 100 * 0.25 + volume * 0.1 + totalCollected * 0.25 + receivedPerActivation * 0.15 + durationScore * 0.15 + consistency * 0.1 - cancellationRate * 0.1;
    }

    const averageTicket = entry.won ? entry.revenue / entry.won : 0;
    const ticketScore = options.maxAverageTicket
        ? averageTicket / options.maxAverageTicket
        : 0;
    return conversion / 100 * 0.45 + volume * 0.2 + ticketScore * 0.15 + consistency * 0.1 - cancellationRate * 0.1;
}

function enrichRankingEntries(entries, options) {
    return entries.map(entry => ({
        ...entry,
        conversion: getRankingConversion(entry.won, entry.lost, options.globalConversion),
        score: getRankingScore(entry, options),
        averageTicket: entry.won ? entry.revenue / entry.won : 0,
        averageReceived: entry.won ? entry.received / entry.won : 0,
        averageCollected: entry.won ? entry.totalCollected / entry.won : 0,
        averageDuration: entry.durationCount ? entry.durationMonths / entry.durationCount : 0,
        cancellationRate: entry.won + entry.cancelled > 0
            ? (entry.cancelled / (entry.won + entry.cancelled)) * 100
            : 0
    }));
}

function getBestRankingEntry(entries, options) {
    return enrichRankingEntries(entries, options)
        .filter(entry => entry.won >= (options.minimumWon || 0))
        .sort((first, second) =>
            second.score - first.score ||
            second.won - first.won ||
            first.label.localeCompare(second.label, "pt-BR")
        )[0] || null;
}

function formatRankingMoney(value) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0
    });
}

function formatRankingConversion(entry, includeRevenue = false) {
    const details = [
        `${entry.conversion.toFixed(1).replace(".", ",")}% conversão ajustada`,
        `${entry.won} ativações`,
        `nota ${(entry.score * 100).toFixed(0)}`
    ];

    if (entry.cancelled > 0) {
        details.push(`${entry.cancellationRate.toFixed(1).replace(".", ",")}% cancelamento`);
    }

    if (includeRevenue && entry.revenue > 0) {
        details.push(formatRankingMoney(entry.revenue));
    }

    return details.join(" • ");
}

function updateTopRanking(metrics, sellerRows) {
    const ranking = document.getElementById("topRanking");
    if (!ranking) return;

    // Cada filtro representa uma nova fotografia do ranking: a posição volta a ser
    // calculada pela nota geral, sem carregar a ordenação manual da base anterior.
    activeRankingSort = {
        category: activeRankingCategory,
        field: "score",
        direction: "desc"
    };

    const normalizedSalesRows = metrics.salesRows;
    const allRankingRows = metrics.rankingRows;
    const rankingReferenceDate = new Date();
    const acquisitionRows = allRankingRows.filter(item =>
        !isAdditionalPlan(item, COLUMN_MAP) && !isOwnershipTransferChannel(item)
    );
    const totalMonths = new Set(allRankingRows.map(getRankingMonthKey).filter(Boolean)).size;
    const acquisitionMonths = new Set(acquisitionRows.map(getRankingMonthKey).filter(Boolean)).size;
    const totalWon = allRankingRows.filter(isWon).length;
    const totalLost = allRankingRows.filter(isLossStatus).length;
    const globalConversion = totalWon + totalLost > 0
        ? totalWon / (totalWon + totalLost)
        : 0;
    const acquisitionWon = acquisitionRows.filter(isWon).length;
    const acquisitionLost = acquisitionRows.filter(isLossStatus).length;
    const acquisitionConversion = acquisitionWon + acquisitionLost > 0
        ? acquisitionWon / (acquisitionWon + acquisitionLost)
        : 0;

    const sellerEntries = getRankingGroupMetrics(allRankingRows, COLUMN_MAP.vendedor);
    const sellerOptions = {
        type: "seller",
        globalConversion,
        totalMonths,
        maxWon: Math.max(...sellerEntries.map(entry => entry.won), 0),
        maxRevenue: Math.max(...sellerEntries.map(entry => entry.revenue), 0),
        maxReceived: Math.max(...sellerEntries.map(entry => entry.received), 0)
    };
    const topSeller = getBestRankingEntry(sellerEntries, sellerOptions);

    const campaignEntries = getRankingGroupMetrics(acquisitionRows, COLUMN_MAP.campanha);
    const channelEntries = getRankingGroupMetrics(acquisitionRows, COLUMN_MAP.canal);
    const conversionOptions = entries => ({
        type: "conversion",
        globalConversion: acquisitionConversion,
        totalMonths: acquisitionMonths,
        minimumWon: 5,
        maxWon: Math.max(...entries.map(entry => entry.won), 0),
        maxAverageTicket: Math.max(...entries.map(entry => entry.won ? entry.revenue / entry.won : 0), 0)
    });
    const topCampaign = getBestRankingEntry(campaignEntries, conversionOptions(campaignEntries));
    const topChannel = getBestRankingEntry(channelEntries, conversionOptions(channelEntries));
    const planEntries = getRankingGroupMetrics(allRankingRows, COLUMN_MAP.plano, rankingReferenceDate, true);
    const planOptions = {
        type: "plan",
        globalConversion,
        totalMonths,
        maxWon: Math.max(...planEntries.map(entry => entry.won), 0),
        maxReceived: Math.max(...planEntries.map(entry => entry.totalCollected), 0),
        maxAverageReceived: Math.max(...planEntries.map(entry => entry.won ? entry.totalCollected / entry.won : 0), 0),
        maxAverageDuration: Math.max(...planEntries.map(entry => entry.durationCount ? entry.durationMonths / entry.durationCount : 0), 0)
    };
    const topPlan = getBestRankingEntry(planEntries, planOptions);

    activeRankingViews = {
        seller: enrichRankingEntries(sellerEntries, sellerOptions),
        campaign: enrichRankingEntries(campaignEntries, conversionOptions(campaignEntries)),
        channel: enrichRankingEntries(channelEntries, conversionOptions(channelEntries))
        ,plan: enrichRankingEntries(planEntries, planOptions)
    };

    const rankingDetailModal = document.getElementById("rankingDetailModal");
    if (rankingDetailModal && !rankingDetailModal.classList.contains("hidden")) {
        renderRankingDetail(activeRankingCategory);
    }

    document.getElementById("topSellerName").textContent = topSeller?.label || "Sem dados";
    document.getElementById("topSellerDetail").textContent = topSeller
        ? `${topSeller.won} ${topSeller.won === 1 ? "venda" : "vendas"} • nota ${(topSeller.score * 100).toFixed(0)} • ${formatRankingMoney(topSeller.revenue)}${topSeller.cancelled ? ` • ${topSeller.cancellationRate.toFixed(1).replace(".", ",")}% cancelamento` : ""}`
        : "Sem vendas no período";

    document.getElementById("topCampaignName").textContent = topCampaign?.label || "Sem campanha elegível";
    document.getElementById("topCampaignDetail").textContent = topCampaign
        ? formatRankingConversion(topCampaign, true)
        : "Nenhuma com 5 ativações";

    document.getElementById("topChannelName").textContent = topChannel?.label || "Sem canal elegível";
    document.getElementById("topChannelDetail").textContent = topChannel
        ? formatRankingConversion(topChannel, true)
        : "Nenhum com 5 ativações";
    document.getElementById("topPlanName").textContent = topPlan?.label || "Sem plano elegível";
    document.getElementById("topPlanDetail").textContent = topPlan
        ? `${formatRankingMoney(topPlan.totalCollected)} recebido + taxa paga • ${formatRankingMoney(topPlan.averageCollected)} por ativação • ${topPlan.averageDuration.toFixed(1).replace(".", ",")} meses • nota ${(topPlan.score * 100).toFixed(0)}`
        : "Sem recebimentos ou taxas no período";

    ranking.classList.toggle("hidden", !normalizedSalesRows.length);
}

function getRankingViewConfig(category) {
    return {
        seller: {
            title: "Ranking de vendedores",
            subtitle: "Volume, conversao, receita, consistencia e qualidade"
        },
        campaign: {
            title: "Ranking de campanhas",
            subtitle: "Aquisicao nova; minimo de 5 ativacoes para destaque"
        },
        channel: {
            title: "Ranking de canais",
            subtitle: "Aquisicao nova; minimo de 5 ativacoes para destaque"
        },
        plan: {
            title: "Ranking de planos",
            subtitle: "Recebimentos e taxas de ativação pagas por plano"
        }
    }[category] || {};
}

function getRankingSortValue(entry, field) {
    if (field === "label") return normalize(entry.label);
    return Number(entry[field] || 0);
}

function getRankingSortHeaders(category) {
    return category === "plan"
        ? [
            ["label", "Plano"], ["won", "Ativacoes"],
            ["received", "Recebido"], ["activationTax", "Taxa paga"],
            ["totalCollected", "Total + taxa"], ["averageCollected", "Total/ativacao"],
            ["averageDuration", "Permanencia media"], ["cancellationRate", "Cancelamentos"], ["score", "Nota"]
        ]
        : [
            ["label", "Nome"], ["won", "Ativacoes"], ["conversion", "Conversao ajustada"],
            ["received", "Valor recebido total"], ["averageReceived", "Recebido/ativacao"],
            ["averageTicket", "Ticket medio"], ["cancellationRate", "Cancelamentos"], ["score", "Nota"]
        ];
}

function renderRankingSortHeader(category) {
    const currentSort = activeRankingSort.category === category
        ? activeRankingSort
        : { field: "score", direction: "desc" };

    return ["<th>Pos.</th>", ...getRankingSortHeaders(category).map(([field, label]) => {
        const isActive = currentSort.field === field;
        const arrow = isActive ? (currentSort.direction === "asc" ? "&#9650;" : "&#9660;") : "&#8597;";
        return `<th><button type="button" class="ranking-sort-button${isActive ? " is-active" : ""}" data-ranking-sort="${field}" aria-label="Ordenar por ${label}" aria-pressed="${isActive}">${label}<span aria-hidden="true">${arrow}</span></button></th>`;
    })].join("");
}

function renderRankingDetail(category = activeRankingCategory) {
    const modal = document.getElementById("rankingDetailModal");
    const title = document.getElementById("rankingDetailTitle");
    const subtitle = document.getElementById("rankingDetailSubtitle");
    const header = document.getElementById("rankingDetailHeader");
    const body = document.getElementById("rankingDetailBody");
    const config = getRankingViewConfig(category);
    if (activeRankingSort.category !== category) {
        activeRankingSort = { category, field: "score", direction: "desc" };
    }

    const entries = [...(activeRankingViews[category] || [])].sort((first, second) => {
        const firstValue = getRankingSortValue(first, activeRankingSort.field);
        const secondValue = getRankingSortValue(second, activeRankingSort.field);
        const comparison = typeof firstValue === "string"
            ? firstValue.localeCompare(secondValue, "pt-BR")
            : firstValue - secondValue;

        return (activeRankingSort.direction === "asc" ? comparison : -comparison) ||
            second.score - first.score || second.won - first.won;
    });
    const rankingPositionByEntry = new Map(
        [...(activeRankingViews[category] || [])]
            .sort((first, second) =>
                second.score - first.score ||
                second.won - first.won ||
                first.label.localeCompare(second.label, "pt-BR")
            )
            .map((entry, index) => [entry, index + 1])
    );

    if (!modal || !title || !subtitle || !header || !body) return;

    activeRankingCategory = category;
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    header.innerHTML = renderRankingSortHeader(category);
    body.innerHTML = "";

    if (!entries.length) {
        body.innerHTML = `<tr><td class="ranking-empty" colspan="${getRankingSortHeaders(category).length + 1}">Nenhum participante elegivel para este periodo.</td></tr>`;
    }

    entries.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${rankingPositionByEntry.get(entry) || index + 1}o</td>
            <td class="font-semibold text-[#fff4e5]">${entry.label}</td>
            <td>${entry.won}</td>
            ${category === "plan" ? "" : `<td>${entry.conversion.toFixed(1).replace(".", ",")}%</td>`}
            <td>${formatRankingMoney(entry.received)}</td>
            ${category === "plan" ? `<td>${formatRankingMoney(entry.activationTax)}</td><td>${formatRankingMoney(entry.totalCollected)}</td><td>${formatRankingMoney(entry.averageCollected)}</td>` : `<td>${formatRankingMoney(entry.averageReceived)}</td>`}
            ${category === "plan" ? "" : `<td>${formatRankingMoney(entry.averageTicket)}</td>`}
            ${category === "plan" ? `<td>${entry.averageDuration.toFixed(1).replace(".", ",")} meses</td>` : ""}
            <td>${entry.cancelled} (${entry.cancellationRate.toFixed(1).replace(".", ",")}%)</td>
            <td class="font-semibold text-[#e7b77d]">${(entry.score * 100).toFixed(0)}</td>
        `;
        body.appendChild(row);
    });

    document.querySelectorAll(".ranking-tab").forEach(tab => {
        tab.classList.toggle("is-active", tab.dataset.rankingTab === category);
    });
    modal.classList.remove("hidden");
}

function logDashboardAudit(filteredRows, prospectsRows, isNewProspect, metrics = currentDashboardMetrics) {
    const activationRows = filteredRows.filter(isWon)
    const uniqueActivationRows = getUniqueWonRows(filteredRows)
    const countActivationsBySeller = rows => countBy(rows, item =>
        normalize(resolveSellerDisplayName(getSellerValue(item))) || "(sem vendedor)"
    )

    const statusCounts = countBy(filteredRows, item =>
        normalize(item[COLUMN_MAP.status]) || "(sem status)"
    );

    const prospectStatusCounts = countBy(prospectsRows, item =>
        normalize(item[COLUMN_MAP.status]) || "(sem status)"
    );

    const strictWonRows = filteredRows.filter(item =>
        STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
    );

    const computedWonRows = filteredRows.filter(isWon);

    const financialOnlyWonRows = computedWonRows.filter(item =>
        !STATUS.won.includes(normalize(item[COLUMN_MAP.status]))
    );

    const lostRows = metrics?.prospectStatusRows.lost || [];
    const noViabilityRows = metrics?.prospectStatusRows.noViability || [];
    const inProgressRows = metrics?.prospectStatusRows.inProgress || [];
    const activationRowsWithReceived = uniqueActivationRows.filter(item =>
        parseCurrencyNumber(item?.[COLUMN_MAP.valorRecebido]) > 0
    );
    const receivedInRankableActivations = activationRowsWithReceived.reduce((total, item) =>
        total + parseCurrencyNumber(item?.[COLUMN_MAP.valorRecebido]), 0
    );

    const additionalRows = filteredRows.filter(item =>
        !isNewProspect(item)
    );

    const duplicateIdReport =
        getDuplicateIdReport(prospectsRows);

    const report = {
        ativacoesValidasAntesDeduplicacao: activationRows.length,
        ativacoesNoKpiAposDeduplicacao: uniqueActivationRows.length,
        ativacoesRemovidasPelaDeduplicacao: activationRows.length - uniqueActivationRows.length,
        linhasAposFiltrosCadastro: filteredRows.length,
        prospectsContadosNoDashboard: prospectsRows.length,
        removidosPorRegraAdicional: additionalRows.length,
        prospectsUnicosPorId: duplicateIdReport.uniqueCount,
        idsDuplicados: duplicateIdReport.duplicateIdCount,
        linhasDuplicadasPorId: duplicateIdReport.duplicateRowCount,
        vencemosPorStatus: strictWonRows.length,
        vencemosRegraAtual: computedWonRows.length,
        vencemosSomentePorContratoValor: financialOnlyWonRows.length,
        ativacoesComRecebimentoNoRanking: activationRowsWithReceived.length,
        ativacoesSemRecebimentoNoRanking: uniqueActivationRows.length - activationRowsWithReceived.length,
        totalRecebidoNasAtivacoesDoRanking: receivedInRankableActivations,
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
        activationRows,
        uniqueActivationRows,
        activationsBeforeDeduplicationBySeller: countActivationsBySeller(activationRows),
        activationsAfterDeduplicationBySeller: countActivationsBySeller(uniqueActivationRows),
        duplicateIds: duplicateIdReport.duplicates
    };

    if (window.receivedAudit) {
        window.dashboardAudit.receivedAudit = window.receivedAudit;
    }

    if (window.DASHBOARD_DEBUG === true) {
        console.groupCollapsed("Auditoria Dashboard Comercial");
        console.table(
            Object.entries(report)
                .map(([chave, valor]) => ({ chave, valor }))
        );
        console.log("Status apos filtros de cadastro:", statusCounts);
        console.log("Status dos prospects contados:", prospectStatusCounts);
        console.log("window.dashboardAudit", window.dashboardAudit);
        console.groupEnd();
    }
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
    const wonOnlySellers = getUniqueWonRows(currentData);

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

let activeProspectModalRows = [];
let activeProspectModalOptions = {};
let prospectModalSortField = "";
let prospectModalSortDirection = "asc";
let activeRankingViews = {};
let activeRankingCategory = "seller";
let activeRankingSort = {
    category: "seller",
    field: "score",
    direction: "desc"
};

function openProspectListForRows(modalTitle, rows, options = {}) {
    const modal = document.getElementById("prospectModal");
    const title = document.getElementById("prospectModalTitle");
    const count = document.getElementById("prospectModalCount");

    if (!modal) return;

    title.textContent = modalTitle || "Prospects";
    count.textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;

    activeProspectModalRows = rows;
    activeProspectModalOptions = { ...options };
    prospectModalSortField = "";
    prospectModalSortDirection = "asc";

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
        normalizedRow[COLUMN_MAP.vendedorProspect] = getProspectSellerValue(normalizedRow);
        normalizedRow[COLUMN_MAP.vendedorContrato] = getContractSellerValue(normalizedRow);

        Object.keys(normalizedRow).forEach(key => {
            if (
                normalize(key).includes("vendedor") &&
                ![COLUMN_MAP.vendedorProspect, COLUMN_MAP.vendedorContrato]
                    .some(field => normalize(key) === normalize(field))
            ) {
                delete normalizedRow[key];
            }
        });

        return normalizedRow;
    });
}

function getModalSortValue(row, column) {
    const value = row?.[column];

    if (value === undefined || value === null || String(value).trim() === "") return "";

    if ([COLUMN_MAP.data, COLUMN_MAP.dataAtivacao, COLUMN_MAP.dataCancelamento, COLUMN_MAP.dataDesistencia].includes(column)) {
        const date = parseDateValue(value);
        if (date) return date.getTime();
    }

    if ([COLUMN_MAP.valorContrato, COLUMN_MAP.taxaAtivacao].includes(column)) {
        return parseCurrencyNumber(value);
    }

    return normalize(String(value));
}

function parseDateValue(value) {
    const text = String(value).trim();
    const brazilianDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);

    if (brazilianDate) {
        const day = Number(brazilianDate[1]);
        const month = Number(brazilianDate[2]);
        const year = Number(brazilianDate[3].length === 2 ? `20${brazilianDate[3]}` : brazilianDate[3]);
        if (day < 1 || month < 1 || year < 1) return null;

        const parsedDate = new Date(year, month - 1, day);
        return parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day
            ? parsedDate
            : null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortProspectRows(rows, field, direction) {
    if (!field) return rows;

    const factor = direction === "desc" ? -1 : 1;
    return rows
        .map((row, index) => ({ row, index, value: getModalSortValue(row, field) }))
        .sort((first, second) => {
            if (first.value === second.value) return first.index - second.index;
            if (first.value === "") return 1;
            if (second.value === "") return -1;
            return (first.value > second.value ? 1 : -1) * factor;
        })
        .map(entry => entry.row);
}

function isActivationDateContext(rows) {
    return rows.length > 0 && rows.every(row =>
        (typeof isWon === "function" && isWon(row)) ||
        normalize(String(row?.[COLUMN_MAP.status] || "")) === "vencemos"
    );
}

function renderProspectTable(rows, options = {}) {
    const header = document.getElementById("prospectListHeader");
    const body = document.getElementById("prospectListBody");
    const empty = document.getElementById("prospectModalEmpty");
    const modalTitleElement = document.getElementById("prospectModalTitle");

    if (!header || !body || !empty) return;

    const displayRows = sanitizeSellerFieldsForModal(sortProspectRows(rows, prospectModalSortField, prospectModalSortDirection));

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

    const hasFilledMotivo = displayRows.some(row => {
        const value = String(row?.[COLUMN_MAP.motivoPerda] ?? "").trim();
        return value !== "" && value !== "-" && value !== "--";
    });

    if (!hasFilledMotivo) {
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

    if (currentTitle.includes("venc")) {
        hiddenColumns.push(COLUMN_MAP.data);
        hiddenColumns.push("Data do cadastro");
        hiddenColumns.push("Data cadastro");
    }

    if (currentTitle.includes("prospect") || currentTitle.includes("andamento") || currentTitle.includes("viabil") || currentTitle.includes("perd")) {
        hiddenColumns.push(COLUMN_MAP.contrato);
        hiddenColumns.push("Contrato Gerado");
        hiddenColumns.push("Contrato");
    }

    const columns = getListColumns(displayRows).filter(column => {
        const originalKey = column;
        const visualLabel = getColumnLabel(column);

        return !hiddenColumns.some(hiddenColumn =>
            normalize(hiddenColumn) === normalize(originalKey) ||
            normalize(hiddenColumn) === normalize(visualLabel)
        );
    });

    const dateColumns = [COLUMN_MAP.data, COLUMN_MAP.dataAtivacao];
    const dateColumnIndex = columns.findIndex(column => dateColumns.includes(column));
    const hasMainDate = displayRows.some(row => getModalDateValue(row));

    dateColumns.forEach(column => {
        const index = columns.indexOf(column);
        if (index >= 0) columns.splice(index, 1);
    });

    if (hasMainDate) {
        const mainDateColumn = currentTitle.includes("venc")
            ? COLUMN_MAP.dataAtivacao
            : COLUMN_MAP.data;
        const mainDateIndex = columns.indexOf(mainDateColumn);
        columns.splice(mainDateIndex >= 0 ? mainDateIndex : columns.length, 0, mainDateColumn);
    }

    const conditionalColumns = [
        COLUMN_MAP.dataCancelamento,
        COLUMN_MAP.dataDesistencia
    ];
    const hasContractDetail = column => displayRows.some(row =>
        hasMeaningfulContractField(row[column])
    );
    conditionalColumns.forEach(column => {
        if (!hasContractDetail(column)) {
            const index = columns.indexOf(column);
            if (index >= 0) columns.splice(index, 1);
        }
    });

    columns.forEach(column => {
        const cell = document.createElement("th");
        cell.className = "p-3 text-left text-white whitespace-normal align-top";

        const label = document.createElement("div");
        label.className = "mb-1";
        label.textContent = column === COLUMN_MAP.data && isActivationDateContext(displayRows)
            ? "Data de ativação"
            : getColumnLabel(column);

        const sortControls = document.createElement("div");
        sortControls.className = "flex items-center gap-1";

        [
            { direction: "asc", icon: "↑", label: "Ordenar crescente" },
            { direction: "desc", icon: "↓", label: "Ordenar decrescente" }
        ].forEach(({ direction, icon, label: buttonLabel }) => {
            const sortButton = document.createElement("button");
            sortButton.type = "button";
            sortButton.className = "prospect-sort-button";
            sortButton.dataset.sortColumn = column;
            sortButton.dataset.sortDirection = direction;
            sortButton.title = buttonLabel;
            sortButton.setAttribute("aria-label", `${buttonLabel}: ${getColumnLabel(column)}`);
            sortButton.textContent = icon;

            if (prospectModalSortField === column && prospectModalSortDirection === direction) {
                sortButton.classList.add("is-active");
            }

            sortControls.appendChild(sortButton);
        });

        cell.appendChild(label);
        cell.appendChild(sortControls);
        header.appendChild(cell);
    });

    displayRows.forEach(row => {
        const line = document.createElement("tr");
        line.className = "hover:bg-orange-300";

        columns.forEach(column => {
            const cell = document.createElement("td");
            cell.className = "p-3 text-white";
            cell.textContent = formatListValue(column, row[column], row);
            line.appendChild(cell);
        });

        body.appendChild(line);
    });
}

function getRowsByDrilldownType(type) {
    const salesRows = (currentFilteredData || []).filter(Boolean);
    const prospectRows = (currentProspectFilteredData || []).filter(Boolean);

    // Prospects-related drilldowns should use the registration-based dataset
    if (type === "prospects") return currentDashboardMetrics?.prospects || prospectRows;
    if (["inProgress", "lost", "noViability"].includes(type)) {
        return currentDashboardMetrics?.prospectStatusRows[type] || [];
    }
    if (type === "inactive") {
        return salesRows.filter(isInactiveContract);
    }
    if (type === "alreadyClients") {
        return getUniqueWonRows(
            salesRows.filter(item => isAdditionalPlan(item, COLUMN_MAP))
        );
    }
    if (["preContract", "withdrawn", "cancelled"].includes(type)) {
        return salesRows.filter(item => getContractStatusCategory(item) === type);
    }

    // Sales/activation-related drilldowns use the sales/activation dataset
    if (type === "won") return currentDashboardMetrics?.wonRows || getUniqueWonRows(salesRows);
    if (type === "installationPaid") return (currentDashboardMetrics?.wonRows || getUniqueWonRows(salesRows)).filter(item => !isFreeInstallation(item));
    if (type === "installationFree") return (currentDashboardMetrics?.wonRows || getUniqueWonRows(salesRows)).filter(item => isFreeInstallation(item));
    if (type === "taxPaid") return salesRows.filter(item => parseCurrencyNumber(item?.[COLUMN_MAP.taxaAtivacao]) > 0);

    return [];
}

function getWinDedupKey(item) {
    const invalidIdentifiers = new Set([
        "", "-", "--", "undefined", "null", "n/a", "na", "sim", "yes",
        "não", "nao", "true", "false", "ativo", "active", "inativo",
        "contrato", "vencemos", "cancelado", "cancelada", "desistiu",
        "pré-contrato", "pre-contrato"
    ]);
    const normalizeIdentifier = value => {
        const identifier = normalize(String(value ?? "")).replace(/\s+/g, " ");
        return invalidIdentifiers.has(identifier) ? "" : identifier;
    };
    const contractIdentifier = [
        item?.[COLUMN_MAP.idContrato],
        item?.[COLUMN_MAP.contrato],
        item?.Contrato
    ].map(normalizeIdentifier).find(Boolean);

    if (contractIdentifier) return `contrato:${contractIdentifier}`;

    const prospectIdentifier = [
        item?.[COLUMN_MAP.id],
        item?.["ID Prospect"],
        item?.["ID do prospect"],
        item?.["Razão"],
        item?.Razao,
        item?.["Nome do cliente"],
        item?.Cliente,
        item?.[COLUMN_MAP.telefone],
        item?.Telefone,
        item?.Celular
    ].map(normalizeIdentifier).find(Boolean) || "";
    const activationDate = extractActivationDate(item)?.getTime() || "";
    const plan = normalizeIdentifier(item?.[COLUMN_MAP.plano]);
    const value = parseFlexibleNumber(item?.[COLUMN_MAP.valorContrato]);

    if (prospectIdentifier && (activationDate || plan || value)) {
        return `prospect:${prospectIdentifier}|data:${activationDate}|plano:${plan}|valor:${value}`;
    }

    return JSON.stringify({
        prospectIdentifier,
        activationDate,
        plan,
        value,
        status: item?.[COLUMN_MAP.status],
        statusContrato: item?.[COLUMN_MAP.statusContrato]
    });
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
            COLUMN_MAP.status, COLUMN_MAP.vendedorProspect, COLUMN_MAP.vendedorContrato, COLUMN_MAP.plano,
            COLUMN_MAP.canal, COLUMN_MAP.campanha, COLUMN_MAP.data
        ];
    }

    const availableColumns = Object.keys(rows[0]);
    const selectedColumns = LIST_COLUMN_CANDIDATES
        .map(candidate => availableColumns.find(column => normalize(column) === normalize(candidate)))
        .filter(Boolean)
        .filter((column, index, columns) => columns.indexOf(column) === index);

    const hasRazao = selectedColumns.some(column => normalize(column) === normalize("Razão"));
    const razaoSocialAliases = ["Razão social", "Razao social", "Razão Social", "Razao Social", "Razão social/nome"];
    const visibleColumns = hasRazao
        ? selectedColumns.filter(column => !razaoSocialAliases.some(alias => normalize(column) === normalize(alias)))
        : selectedColumns;

    return visibleColumns.length ? visibleColumns : availableColumns.slice(0, 8);
}

function getColumnLabel(column) {
    if (column === COLUMN_MAP.motivoPerda) return "Motivo";
    return column;
}

function formatListValue(column, value, row) {
    if (column === COLUMN_MAP.data) {
        return getModalDateValue(row) || "-";
    }

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

document.getElementById("prospectListHeader").addEventListener("click", event => {
    const sortButton = event.target.closest("button[data-sort-column]");
    if (!sortButton) return;

    const isSameSort = prospectModalSortField === sortButton.dataset.sortColumn &&
        prospectModalSortDirection === sortButton.dataset.sortDirection;

    if (isSameSort) {
        prospectModalSortField = "";
    } else {
        prospectModalSortField = sortButton.dataset.sortColumn;
        prospectModalSortDirection = sortButton.dataset.sortDirection;
    }

    renderProspectTable(activeProspectModalRows, activeProspectModalOptions);
});

document.getElementById("topRanking").addEventListener("click", event => {
    const card = event.target.closest("[data-ranking-category]");
    if (card) renderRankingDetail(card.dataset.rankingCategory);
});

document.getElementById("topRanking").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-ranking-category]");
    if (!card) return;

    event.preventDefault();
    renderRankingDetail(card.dataset.rankingCategory);
});

document.getElementById("rankingDetailHeader").addEventListener("click", event => {
    const sortButton = event.target.closest("button[data-ranking-sort]");
    if (!sortButton) return;

    const field = sortButton.dataset.rankingSort;
    const isSameSort = activeRankingSort.category === activeRankingCategory &&
        activeRankingSort.field === field;

    activeRankingSort = {
        category: activeRankingCategory,
        field,
        direction: isSameSort && activeRankingSort.direction === "asc" ? "desc" : "asc"
    };
    renderRankingDetail(activeRankingCategory);
});

document.querySelectorAll(".ranking-tab").forEach(tab => {
    tab.addEventListener("click", () => renderRankingDetail(tab.dataset.rankingTab));
});

document.getElementById("closeRankingDetailModal").addEventListener("click", () => {
    document.getElementById("rankingDetailModal").classList.add("hidden");
});

document.getElementById("rankingDetailModal").addEventListener("click", event => {
    if (event.target.id === "rankingDetailModal") {
        event.currentTarget.classList.add("hidden");
    }
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    closeProspectList();
    document.getElementById("rankingDetailModal").classList.add("hidden");
});
