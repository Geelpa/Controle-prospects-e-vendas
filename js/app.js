function getFilteredDailyAverage(rows, getDate) {
    const dates = rows
        .map(getDate)
        .filter(date => date instanceof Date && !Number.isNaN(date.getTime()))
        .map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate()))
    const uniqueMonths = new Set(dates.map(date =>
        `${date.getFullYear()}-${date.getMonth()}`
    ))
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    const selectedMonth = document.getElementById("monthFilter")?.value || "all"
    const selectedYear = document.getElementById("yearFilter")?.value || "all"
    let elapsedDays = 0

    if (selectedMonth !== "all" && selectedYear !== "all") {
        const year = Number(selectedYear)
        const month = Number(selectedMonth) - 1
        const start = new Date(year, month, 1)
        if (start <= currentDate) {
            const monthDays = new Date(year, month + 1, 0).getDate()
            elapsedDays = year === currentDate.getFullYear() && month === currentDate.getMonth()
                ? currentDate.getDate()
                : monthDays
        }
    } else if (selectedMonth !== "all") {
        uniqueMonths.forEach(monthKey => {
            const [year, month] = monthKey.split("-").map(Number)
            const start = new Date(year, month, 1)
            if (start > currentDate) return
            const monthDays = new Date(year, month + 1, 0).getDate()
            elapsedDays += year === currentDate.getFullYear() && month === currentDate.getMonth()
                ? currentDate.getDate()
                : monthDays
        })
    } else if (selectedYear !== "all") {
        const year = Number(selectedYear)
        const start = new Date(year, 0, 1)
        if (start <= currentDate) {
            elapsedDays = year === currentDate.getFullYear()
                ? Math.floor((currentDate - start) / 86400000) + 1
                : (new Date(year + 1, 0, 1) - start) / 86400000
        }
    } else if (dates.length) {
        const firstDate = dates.reduce((earliest, date) =>
            date < earliest ? date : earliest
        )
        const latestDate = dates.reduce((latest, date) =>
            date > latest ? date : latest
        )
        const lastDate = latestDate > currentDate ? currentDate : latestDate
        elapsedDays = lastDate >= firstDate
            ? Math.floor((lastDate - firstDate) / 86400000) + 1
            : 0
    }

    return elapsedDays > 0 ? dates.length / elapsedDays : null
}

let latestGoalSummary = null

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
    const prospectsDailyAverage = getFilteredDailyAverage(
        prospectsData,
        extractRegistrationDate
    );
    const activationsDailyAverage = getFilteredDailyAverage(
        wonRows,
        extractActivationDate
    );
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
        prospectsDailyAverage,
        activationsDailyAverage,
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

    // Gráficos de comparação de status também precisam dos prospects sem contrato,
    // pois perdas e registros sem viabilidade não entram na base de vendas/ativação.
    const statusChartRows = [
        ...(salesData || []),
        ...prospectsData
    ];
    if (typeof createChannelsChart === "function") createChannelsChart(statusChartRows);
    if (typeof createCampaignsChart === "function") createCampaignsChart(statusChartRows);
    if (typeof createLossReasonsChart === "function") createLossReasonsChart(statusChartRows);
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

async function writeGoalSummaryToClipboard(text) {
    let clipboardError = null
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch (error) {
            clipboardError = error
        }
    }

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = typeof document.execCommand === "function" &&
        document.execCommand("copy")
    textarea.remove()

    if (!copied) {
        throw clipboardError || new Error("O navegador não permitiu copiar o resumo.")
    }
}

async function copyGoalSummary(section) {
    const statusId = section === "leads"
        ? "leadGoalCopyStatus"
        : "activationGoalCopyStatus"
    const status = document.getElementById(statusId)
    const summary = latestGoalSummary?.[section]
    if (!summary) {
        if (status) status.textContent = "Carregue os dados para gerar o resumo."
        return
    }

    try {
        await writeGoalSummaryToClipboard(summary)
        if (status) status.textContent = "Resumo copiado."
    } catch (error) {
        console.error("Não foi possível copiar o resumo da meta.", error)
        if (status) status.textContent = "Não foi possível copiar. Verifique a permissão do navegador."
    }
}

function getChartForCopy(chartKey) {
    const charts = {
        plans: plansChart,
        sellers: sellersChart,
        channels: channelsChart,
        campaigns: campaignsChart,
        lossReasons: lossReasonsChart,
        salesPerDay: salesPerDayChart,
        installation: installationChart
    }

    return charts[chartKey]
}

function getSelectedFilterLabel(id) {
    const select = document.getElementById(id)
    if (!select) return ""

    const selectedOption = select.options[select.selectedIndex]
    return selectedOption?.textContent?.trim() || ""
}

function formatChartSummaryValue(value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return "0"

    return numericValue.toLocaleString("pt-BR", {
        minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
        maximumFractionDigits: 2
    })
}

function getChartSummary(chartKey) {
    const chart = getChartForCopy(chartKey)
    if (!chart || !chart.data?.labels?.length) return ""

    const headingId = chartKey === "salesPerDay"
        ? "salesChartTitle"
        : `${chartKey}ChartHeading`
    const title = document.getElementById(headingId)?.textContent?.trim() || "Resumo do gráfico"
    const month = getSelectedFilterLabel("monthFilter")
    const year = getSelectedFilterLabel("yearFilter")
    const seller = getSelectedFilterLabel("sellerFilter")
    const filterParts = [month !== "Todos" ? month : "", year !== "Todos" ? year : ""]
        .filter(Boolean)
    const lines = [title]

    if (filterParts.length || (seller && seller !== "Todos")) {
        lines.push(`Filtros: ${[...filterParts, seller && seller !== "Todos" ? `Vendedor: ${seller}` : ""].filter(Boolean).join(" · ")}`)
    }
    if (chartKey === "salesPerDay") {
        const grouping = getSelectedFilterLabel("salesViewFilter")
        const week = getSelectedFilterLabel("weekFilter")
        if (grouping) lines.push(`Agrupamento: ${grouping}`)
        if (week && document.getElementById("weekFilter")?.value !== "all") {
            lines.push(`Semana: ${week}`)
        }
    }

    const labels = chart.data.labels.map(label =>
        Array.isArray(label) ? label.join(" ") : String(label ?? "")
    )
    const datasets = chart.data.datasets || []
    const summaryEntries = chart.summaryEntries

    if (chart.config.type === "doughnut" || chart.config.type === "pie") {
        const values = datasets[0]?.data || []
        const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0)
        lines.push(`Total: ${formatChartSummaryValue(total)}`)
        labels.forEach((label, index) => {
            const value = Number(values[index]) || 0
            const percent = total ? (value / total * 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }) : "0,0"
            lines.push(`${label}: ${formatChartSummaryValue(value)} (${percent}%)`)
        })
        return lines.join("\n")
    }

    if (summaryEntries?.length && Array.isArray(summaryEntries[0])) {
        const total = summaryEntries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
        lines.push(`Total: ${formatChartSummaryValue(total)}`)
        summaryEntries.forEach(([label, value]) => {
            lines.push(`${label}: ${formatChartSummaryValue(value)}`)
        })
        return lines.join("\n")
    }

    if (summaryEntries?.length && !Array.isArray(summaryEntries[0])) {
        const statusTypes = [
            ["won", "Vencemos"],
            ["lost", "Perdemos"],
            ["noViability", "Sem viabilidade"]
        ]
        const totals = statusTypes.map(([key]) =>
            summaryEntries.reduce((sum, entry) => sum + (Number(entry[key]) || 0), 0)
        )
        lines.push(`Total: ${formatChartSummaryValue(summaryEntries.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0))}`)
        statusTypes.forEach(([key, label], index) => {
            if (totals[index]) lines.push(`- ${label}: ${formatChartSummaryValue(totals[index])}`)
        })
        lines.push("Detalhamento:")
        summaryEntries.forEach(entry => {
            const values = statusTypes
                .filter(([key]) => Number(entry[key]) > 0)
                .map(([key, label]) => `${label}: ${formatChartSummaryValue(entry[key])}`)
            lines.push(`${entry.label}: ${values.join(" | ")} | Total: ${formatChartSummaryValue(entry.total)}`)
        })
        return lines.join("\n")
    }

    const totals = datasets.map(dataset =>
        (dataset.data || []).reduce((sum, value) => sum + (Number(value) || 0), 0)
    )
    lines.push("Totais por série:")
    datasets.forEach((dataset, index) => {
        lines.push(`- ${dataset.label || `Série ${index + 1}`}: ${formatChartSummaryValue(totals[index])}`)
    })
    lines.push("Detalhamento:")

    labels.forEach((label, index) => {
        const values = datasets.map((dataset, datasetIndex) =>
            `${dataset.label || `Série ${datasetIndex + 1}`}: ${formatChartSummaryValue(dataset.data?.[index])}`
        )
        lines.push(`${label}: ${values.join(" | ")}`)
    })

    return lines.join("\n")
}

document.querySelectorAll("[data-chart-copy]").forEach(button => {
    button.addEventListener("click", async () => {
        const chartKey = button.dataset.chartCopy
        const status = document.getElementById(`${chartKey}ChartCopyStatus`)
        const summary = getChartSummary(chartKey)

        if (!summary) {
            if (status) status.textContent = "Nenhum dado disponível para copiar."
            return
        }

        try {
            await writeGoalSummaryToClipboard(summary)
            if (status) status.textContent = "Resumo copiado."
        } catch (error) {
            console.error(`Não foi possível copiar o resumo do gráfico "${chartKey}".`, error)
            if (status) status.textContent = "Falha ao copiar. Verifique a permissão do navegador."
        }
    })
})

document.getElementById("copyLeadGoal")?.addEventListener("click", () =>
    copyGoalSummary("leads")
)
document.getElementById("copyActivationGoal")?.addEventListener("click", () =>
    copyGoalSummary("activations")
)

updateMonthlyGoal()

function updateMonthlyGoal() {
    const title = document.getElementById("goalMonthTitle")
    if (!title) return

    const currentDate = new Date()
    const selectedMonth = document.getElementById("monthFilter")?.value || "all"
    const selectedYear = document.getElementById("yearFilter")?.value || "all"
    const targetMonth = selectedMonth === "all"
        ? currentDate.getMonth() + 1
        : Number(selectedMonth)
    const targetYear = selectedYear === "all"
        ? currentDate.getFullYear()
        : Number(selectedYear)
    const targetDate = new Date(targetYear, targetMonth - 1, 1)

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
    const formatCount = value => Math.ceil(value || 0).toLocaleString("pt-BR")
    const formatDailyAverage = value => value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    const monthlyActivationGoal = 240

    const selectedSeller = normalize(document.getElementById("sellerFilter")?.value || "all")
    const query = document.getElementById("globalSearch")?.value || ""
    const matchesGoalFilters = (item, preferContractSeller = false) => {
        if (query && !matchesGlobalSearch(item, query)) return false
        if (selectedSeller === "all") return true

        const seller = preferContractSeller
            ? getContractSellerValue(item) || getSellerValue(item)
            : getProspectSellerValue(item) || getSellerValue(item)
        return normalize(resolveSellerDisplayName(seller)) === selectedSeller
    }

    const targetMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    const targetMonthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
    const targetMonthDays = targetMonthEnd.getDate()
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const isTargetMonthCurrent = targetDate.getTime() === currentMonthStart.getTime()
    const isTargetMonthFuture = targetMonthStart > currentMonthStart
    const observedThroughDate = isTargetMonthFuture
        ? new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), 0)
        : isTargetMonthCurrent
            ? currentDate
            : targetMonthEnd
    const getProspectKey = item => {
        const prospectId = typeof getProspectId === "function" ? getProspectId(item) : ""
        return prospectId ? `prospect:${prospectId}` : ""
    }

    const uniqueLeads = new Map()
    const prospectRows = (rawData || []).filter(item =>
        isNewProspect(item, COLUMN_MAP) && matchesGoalFilters(item)
    )
    prospectRows.forEach(item => {
        const date = extractRegistrationDate(item)
        if (!date || date > observedThroughDate) return

        const key = getProspectKey(item)
        if (!key || !uniqueLeads.has(key)) {
            uniqueLeads.set(key || Symbol(), { item, date })
        }
    })
    const monthLeads = Array.from(uniqueLeads.values()).filter(({ date }) =>
        date >= targetMonthStart && date <= observedThroughDate
    )

    const monthActivationRows = getUniqueWonRows((rawData || []).filter(item =>
        matchesGoalFilters(item, true)
    )).map(item => ({ item, date: extractActivationDate(item) }))
        .filter(entry => entry.date &&
            entry.date >= targetMonthStart &&
            entry.date <= observedThroughDate)

    const acquisitionRows = monthLeads
        .map(entry => entry.item)
        .filter(item => !isOwnershipTransferChannel(item))
    const conversionWins = getUniqueWonRows(acquisitionRows).length
    const conversionLosses = acquisitionRows.filter(item =>
        STATUS.lost.includes(normalize(item?.[COLUMN_MAP.status]))
    ).length
    const completedOpportunities = conversionWins + conversionLosses
    const conversionRate = completedOpportunities > 0
        ? conversionWins / completedOpportunities
        : 0
    const elapsedMonthDays = isTargetMonthFuture
        ? 0
        : isTargetMonthCurrent
            ? Math.min(currentDate.getDate(), targetMonthDays)
            : targetMonthDays
    const leadDailyAverage = elapsedMonthDays > 0
        ? monthLeads.length / elapsedMonthDays
        : null
    const activationDailyAverage = elapsedMonthDays > 0
        ? monthActivationRows.length / elapsedMonthDays
        : null
    const projectedLeadCount = elapsedMonthDays > 0
        ? isTargetMonthCurrent
            ? monthLeads.length / elapsedMonthDays * targetMonthDays
            : monthLeads.length
        : null
    const leadTarget = conversionRate > 0
        ? Math.ceil(monthlyActivationGoal / conversionRate)
        : null
    const estimatedActivations = leadTarget === null || projectedLeadCount === null
        ? null
        : projectedLeadCount * conversionRate
    const remainingLeads = leadTarget === null
        ? null
        : Math.max(0, leadTarget - monthLeads.length)
    const remainingActivations = Math.max(0, monthlyActivationGoal - monthActivationRows.length)
    const leadProgress = leadTarget
        ? Math.min(100, monthLeads.length / leadTarget * 100)
        : 0
    const activationProgress = Math.min(100, monthActivationRows.length / monthlyActivationGoal * 100)
    const formatPercent = (value, target) => target > 0
        ? `${(value / target * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
        : "--"

    const leadProgressBar = document.getElementById("leadGoalProgress")
    if (leadProgressBar) {
        leadProgressBar.style.width = `${leadProgress}%`
        leadProgressBar.parentElement?.setAttribute("aria-valuenow", String(Math.round(leadProgress)))
    }
    const activationProgressBar = document.getElementById("activationGoalProgress")
    if (activationProgressBar) {
        activationProgressBar.style.width = `${activationProgress}%`
        activationProgressBar.parentElement?.setAttribute("aria-valuenow", String(Math.round(activationProgress)))
    }

    setText("activationMonthlyTarget", formatCount(monthlyActivationGoal))
    setText("activationMonthActual", formatCount(monthActivationRows.length))
    setText("activationRemainingTarget", `${formatCount(remainingActivations)} ativações restantes para a meta`)
    setText("activationDailyAverage", activationDailyAverage === null
        ? "--"
        : `${formatDailyAverage(activationDailyAverage)} por dia`)
    setText("activationEstimatedTarget", estimatedActivations === null
        ? "--"
        : Math.round(estimatedActivations).toLocaleString("pt-BR"))
    setText("activationConversionSummary", conversionRate > 0
        ? `${(conversionRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
        : "--")
    setText("activationGoalFormula", leadTarget === null
        ? "Sem conversões concluídas neste mês para calcular a projeção."
        : projectedLeadCount === null
            ? `Projeção indisponível para o mês futuro. Conversão do mês: ${(conversionRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.`
            : `${formatDailyAverage(projectedLeadCount / targetMonthDays)} leads/dia projetam ${formatCount(projectedLeadCount)} leads no mês; × ${(conversionRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de conversão = ${Math.round(estimatedActivations).toLocaleString("pt-BR")} ativações estimadas.`)
    setText("leadMonthlyTarget", leadTarget === null ? "--" : formatCount(leadTarget))
    setText("leadMonthActual", formatCount(monthLeads.length))
    setText("leadRemainingTarget", remainingLeads === null
        ? "Leads restantes: indisponível sem conversão do mês"
        : `${formatCount(remainingLeads)} leads restantes para a meta`)
    setText("leadDailyAverage", leadDailyAverage === null
        ? "--"
        : `${formatDailyAverage(leadDailyAverage)} por dia`)
    setText("leadEstimatedTarget", projectedLeadCount === null
        ? "--"
        : formatCount(projectedLeadCount))
    setText("leadGoalFormula", leadTarget === null
        ? `Sem oportunidades concluídas no mês de ${targetLabel}; a meta de ${formatCount(monthlyActivationGoal)} ativações não pode ser convertida em quantidade de leads.`
        : `${formatCount(monthlyActivationGoal)} ativações ÷ ${(conversionRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de conversão deste mês = ${formatCount(leadTarget)} leads no total.`)
    setText("goalConversion", conversionRate > 0
        ? `${(conversionRate * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
        : "--")
    setText("goalConversionDetail", completedOpportunities > 0
        ? `${conversionWins} ativações ÷ ${completedOpportunities} oportunidades concluídas entre os leads cadastrados em ${formatMonth(targetDate)}`
        : `Sem oportunidades concluídas entre os leads cadastrados em ${formatMonth(targetDate)}`)
    setText("goalHistoryPeriod", isTargetMonthFuture
        ? `Mês selecionado: ${targetLabel} · O período ainda não começou.`
        : `Mês analisado: ${targetLabel} · ${formatCount(monthLeads.length)} leads cadastrados · ${formatCount(monthActivationRows.length)} ativações realizadas · Conversão calculada apenas com leads concluídos neste mês.`)
    setText("goalStatus", leadTarget === null
        ? `Meta fixa: ${formatCount(monthlyActivationGoal)} ativações. A conversão será calculada quando houver oportunidades concluídas no mês selecionado.`
        : `Projeção e conversão calculadas com os dados de ${targetLabel}; o realizado e os leads restantes refletem o andamento do próprio mês.`)

    latestGoalSummary = {
        leads: [
            `Meta de ${targetLabel} — Leads / prospects`,
            `Realizado: ${formatCount(monthLeads.length)} de ${leadTarget === null ? "meta não calculada" : `${formatCount(leadTarget)} necessários`} (${formatPercent(monthLeads.length, leadTarget)}).`,
            `Projeção até o fim do mês: ${projectedLeadCount === null ? "indisponível" : formatCount(projectedLeadCount)} leads.`,
            `Conversão da safra: ${conversionRate > 0 ? `${(conversionRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "indisponível"}.`
        ].join("\n"),
        activations: [
            `Meta de ${targetLabel} — Ativações`,
            `Realizado: ${formatCount(monthActivationRows.length)} de ${formatCount(monthlyActivationGoal)} (${formatPercent(monthActivationRows.length, monthlyActivationGoal)}).`,
            estimatedActivations === null
                ? "Estimativa até o fim do mês: indisponível sem conversão calculada."
                : `Estimativa até o fim do mês: ${formatCount(Math.round(estimatedActivations))} ativações.`
        ].join("\n")
    }
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
