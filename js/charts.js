const CHART_COLORS = {
    blue: "#2563eb",
    cyan: "#0891b2",
    emerald: "#059646",
    amber: "#c46f0f",
    rose: "#f50808",
    violet: "#7c3aed",
    slate: "#475569",
    grid: "#e2e8f0",
    text: "#334155",
    muted: "#64748b"
}

const emptyStatePlugin = {
    id: "emptyState",
    beforeDraw(chart) {
        const hasData = chart.data.datasets.some(dataset =>
            dataset.data.some(value => Number(value) > 0)
        )

        if (hasData) return

        const { ctx, chartArea } = chart

        ctx.save()
        ctx.fillStyle = CHART_COLORS.muted
        ctx.font = "600 14px system-ui, -apple-system, Segoe UI, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(
            "Sem dados para o filtro selecionado",
            (chartArea.left + chartArea.right) / 2,
            (chartArea.top + chartArea.bottom) / 2
        )
        ctx.restore()
    }
}

const barValueLabelsPlugin = {
    id: "barValueLabels",
    afterDatasetsDraw(chart) {
        const dataset =
            chart.data.datasets[0]

        if (!dataset || chart.config.type !== "bar") return

        const values =
            dataset.data.map(value => Number(value) || 0)

        const total =
            values.reduce((sum, value) => sum + value, 0)

        if (!total) return

        const meta =
            chart.getDatasetMeta(0)

        const { ctx, chartArea } = chart

        ctx.save()
        ctx.font = "700 12px Inter, system-ui, sans-serif"
        ctx.textBaseline = "middle"

        meta.data.forEach((bar, index) => {
            const value = values[index]
            const percent =
                ((value / total) * 100).toFixed(1)
            const label =
                `${value} (${percent}%)`

            ctx.textAlign = "left"
            ctx.fillStyle = CHART_COLORS.text
            ctx.fillText(
                label,
                bar.x + 8,
                bar.y
            )
        })

        ctx.restore()
    }
}

const stackedBarValueLabelsPlugin = {
    id: "stackedBarValueLabels",
    afterDatasetsDraw(chart) {
        if (chart.config.type !== "bar") return

        const datasets =
            chart.data.datasets || []

        if (datasets.length < 2) return

        const { ctx } = chart

        ctx.save()
        ctx.font = "700 12px Inter, system-ui, sans-serif"
        ctx.textBaseline = "middle"

        const totals =
            chart.data.labels.map((_, index) =>
                datasets.reduce(
                    (sum, dataset) => sum + (Number(dataset.data[index]) || 0),
                    0
                )
            )

        datasets.forEach((dataset, datasetIndex) => {
            const meta =
                chart.getDatasetMeta(datasetIndex)

            meta.data.forEach((bar, index) => {
                const value =
                    Number(dataset.data[index]) || 0

                if (!value) return

                const width =
                    Math.abs(bar.x - bar.base)

                if (width < 32) return

                ctx.textAlign = "center"
                ctx.fillStyle = "#ffffff"
                ctx.fillText(
                    value,
                    bar.base + ((bar.x - bar.base) / 2),
                    bar.y
                )
            })
        })

        const lastDataset = datasets[datasets.length - 1];
        const lastMeta = chart.getDatasetMeta(datasets.length - 1);

        // Garante que o meta e os dados da barra existem antes de rodar o loop
        if (lastMeta && lastMeta.data) {
            lastMeta.data.forEach((bar, index) => {
                const total = totals ? totals[index] : null;

                // Se não tiver o total ou se a barra ainda não foi calculada pelo Chart.js, ignora e não quebra
                if (!total || !bar || typeof bar.x === 'undefined' || typeof bar.y === 'undefined') return;

                ctx.textAlign = "left";
                ctx.fillStyle = CHART_COLORS.text;

                // Desenha o texto com segurança
                ctx.fillText(
                    `Total ${total}`,
                    bar.x + 8,
                    bar.y
                );
            });
        }

        ctx.restore()
    }
}

const doughnutValueLabelsPlugin = {
    id: "doughnutValueLabels",
    afterDatasetsDraw(chart) {
        if (chart.config.type !== "doughnut") return

        const dataset =
            chart.data.datasets[0]

        if (!dataset) return

        const values =
            dataset.data.map(value => Number(value) || 0)

        const total =
            values.reduce((sum, value) => sum + value, 0)

        if (!total) return

        const meta =
            chart.getDatasetMeta(0)

        const { ctx } = chart

        ctx.save()
        ctx.font = "700 12px Inter, system-ui, sans-serif"
        ctx.fillStyle = "#ffffff"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        meta.data.forEach((arc, index) => {
            const value = values[index]
            const percent =
                ((value / total) * 100).toFixed(1)
            const position =
                arc.tooltipPosition()

            ctx.fillText(
                `${value} (${percent}%)`,
                position.x,
                position.y
            )
        })

        ctx.restore()
    }
}

function getTopEntries(grouped, limit = 10) {
    return Object.entries(grouped)
        .filter(([label]) => label && normalize(label) !== "undefined")
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
}

function wrapLabel(label, maxLength = 24) {
    const words = String(label).split(" ")
    const lines = []
    let currentLine = ""

    words.forEach(word => {
        const nextLine = currentLine
            ? `${currentLine} ${word}`
            : word

        if (nextLine.length > maxLength && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = nextLine
        }
    })

    if (currentLine) {
        lines.push(currentLine)
    }

    return lines
}

function baseOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 350
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: "#0f172a",
                titleColor: "#ffffff",
                bodyColor: "#e2e8f0",
                padding: 12,
                cornerRadius: 6,
                displayColors: false,
                callbacks: {
                    label(context) {
                        return `${context.dataset.label}: ${context.parsed.x ?? context.parsed.y}`
                    }
                }
            }
        }
    }
}

function horizontalBarOptions() {
    return {
        ...baseOptions(),
        indexAxis: "y",
        scales: {
            x: {
                beginAtZero: true,
                suggestedMax: 0,
                ticks: {
                    precision: 0,
                    color: CHART_COLORS.muted
                },
                grid: {
                    color: CHART_COLORS.grid,
                    drawBorder: false
                },
                border: {
                    display: false
                }
            },
            y: {
                ticks: {
                    autoSkip: false,
                    color: CHART_COLORS.text,
                    font: {
                        size: 12,
                        weight: "600"
                    }
                },
                grid: {
                    display: false
                },
                border: {
                    display: false
                }
            }
        }
    }
}

function createHorizontalBarChart(canvasId, label, entries, color, onSelectEntry) {
    const values =
        entries.map(([_, value]) => value)
    const maxValue =
        Math.max(...values, 0)
    const options =
        horizontalBarOptions()

    options.scales.x.suggestedMax =
        maxValue ? Math.ceil(maxValue * 1.24) : 0

    if (typeof onSelectEntry === "function") {
        options.onClick = (event, elements) => {
            if (!elements.length) return

            const entry =
                entries[elements[0].index]

            if (entry) {
                onSelectEntry(entry[0])
            }
        }

        options.onHover = (event, elements) => {
            event.native.target.style.cursor =
                elements.length ? "pointer" : "default"
        }
    }

    return new Chart(
        document.getElementById(canvasId),
        {
            type: "bar",
            data: {
                labels: entries.map(([itemLabel]) => wrapLabel(itemLabel)),
                datasets: [{
                    label,
                    data: values,
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.72,
                    categoryPercentage: 0.72
                }]
            },
            options,
            plugins: [emptyStatePlugin, barValueLabelsPlugin]
        }
    )
}

function createSplitStatusBarChart(canvasId, entries, onSelectEntry) {
    const maxValue =
        Math.max(...entries.map(entry => entry.total), 0)
    const options =
        horizontalBarOptions()

    options.scales.x.stacked = true
    options.scales.y.stacked = true
    options.scales.x.suggestedMax =
        maxValue ? Math.ceil(maxValue * 1.28) : 0
    options.scales.x.ticks.display = false
    options.scales.x.grid.display = false

    options.plugins.legend = {
        display: true,
        position: "top",
        align: "end",
        labels: {
            color: CHART_COLORS.text,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            boxHeight: 8,
            padding: 12,
            font: {
                size: 12,
                weight: "600"
            }
        }
    }

    options.plugins.tooltip = {
        ...baseOptions().plugins.tooltip,
        displayColors: true,
        callbacks: {
            title(context) {
                return entries[context[0].dataIndex]?.label || ""
            },
            label(context) {
                const value =
                    Number(context.parsed.x) || 0
                const entry =
                    entries[context.dataIndex]
                const percent =
                    entry?.total
                        ? ((value / entry.total) * 100).toFixed(1)
                        : "0.0"

                return `${context.dataset.label}: ${value} (${percent}%)`
            },
            afterBody(context) {
                const entry =
                    entries[context[0].dataIndex]

                return entry
                    ? [`Total: ${entry.total}`]
                    : []
            }
        }
    }

    if (typeof onSelectEntry === "function") {
        options.onClick = (event, elements) => {
            if (!elements.length) return

            const element =
                elements[0]
            const entry =
                entries[element.index]
            const dataset =
                element.datasetIndex === 0
                    ? "won"
                    : "lost"

            if (entry) {
                onSelectEntry(entry.label, dataset)
            }
        }

        options.onHover = (event, elements) => {
            event.native.target.style.cursor =
                elements.length ? "pointer" : "default"
        }
    }

    return new Chart(
        document.getElementById(canvasId),
        {
            type: "bar",
            data: {
                labels: entries.map(entry => wrapLabel(entry.label)),
                datasets: [
                    {
                        label: "Vencemos",
                        data: entries.map(entry => entry.won),
                        backgroundColor: CHART_COLORS.emerald,
                        borderColor: CHART_COLORS.emerald,
                        borderWidth: 0,
                        borderRadius: {
                            topLeft: 6,
                            bottomLeft: 6,
                            topRight: 0,
                            bottomRight: 0
                        },
                        borderSkipped: false,
                        barPercentage: 0.64,
                        categoryPercentage: 0.76
                    },
                    {
                        label: "Perdemos",
                        data: entries.map(entry => entry.lost),
                        backgroundColor: CHART_COLORS.rose,
                        borderColor: CHART_COLORS.rose,
                        borderWidth: 0,
                        borderRadius: {
                            topLeft: 0,
                            bottomLeft: 0,
                            topRight: 6,
                            bottomRight: 6
                        },
                        borderSkipped: false,
                        barPercentage: 0.64,
                        categoryPercentage: 0.76
                    }
                ]
            },
            options,
            plugins: [emptyStatePlugin, stackedBarValueLabelsPlugin]
        }
    )
}

function getChartDisplayValue(item, columnName) {
    let key = item[columnName]

    if (columnName === COLUMN_MAP.plano) {
        return key || "Sem plano"
    }

    if (columnName === COLUMN_MAP.campanha) {
        return key || "Sem campanha"
    }

    if (columnName === COLUMN_MAP.canal) {
        return key || "Sem canal"
    }

    if (columnName === COLUMN_MAP.vendedor) {
        return SELLER_MAP[key] || `Vendedor ${key}`
    }

    return key || "Sem registro"
}

function rowsMatchingChartValue(data, columnName, label, rowFilter) {
    return data.filter(item => {
        if (typeof rowFilter === "function" && !rowFilter(item)) {
            return false
        }

        return normalize(getChartDisplayValue(item, columnName)) === normalize(label)
    })
}

function openChartRows(title, rows) {
    if (typeof openProspectListForRows === "function") {
        openProspectListForRows(title, rows)
    }
}

function isWonStatus(item) {
    return STATUS.won.includes(
        normalize(item[COLUMN_MAP.status])
    )
}

function isLostStatus(item) {
    return STATUS.lost.includes(
        normalize(item[COLUMN_MAP.status])
    )
}

function getSplitStatusEntries(data, columnName, limit = 8) {
    const grouped = {}

    data.forEach(item => {
        if (!isWonStatus(item) && !isLostStatus(item)) return

        const label =
            getChartDisplayValue(item, columnName)

        if (!label || normalize(label) === "undefined") return

        if (!grouped[label]) {
            grouped[label] = {
                label,
                won: 0,
                lost: 0,
                total: 0
            }
        }

        if (isWonStatus(item)) {
            grouped[label].won++
        }

        if (isLostStatus(item)) {
            grouped[label].lost++
        }

        grouped[label].total++
    })

    return Object.values(grouped)
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
}

function hasSplitComparisonData(entries) {
    return entries.filter(entry =>
        Number(entry.total) > 0
    ).length >= 2
}

function rowsMatchingChartStatus(data, columnName, label, statusType) {
    return rowsMatchingChartValue(
        data,
        columnName,
        label,
        item => statusType === "won"
            ? isWonStatus(item)
            : isLostStatus(item)
    )
}

function toggleChartCard(cardId, shouldShow) {
    const card =
        document.getElementById(cardId)

    if (!card) return

    card.classList.toggle("hidden", !shouldShow)
}

function hasComparisonData(entries) {
    return entries.filter(([_, value]) =>
        Number(value) > 0
    ).length >= 2
}

function mainDateFiltersSelected() {
    const month =
        document.getElementById("monthFilter")?.value

    const year =
        document.getElementById("yearFilter")?.value

    return month && year && month !== "all" && year !== "all"
}

function getSalesChartState() {
    const salesViewFilter =
        document.getElementById("salesViewFilter")

    const weekFilter =
        document.getElementById("weekFilter")

    return {
        view: salesViewFilter?.value || "month",
        week: weekFilter?.value || "all"
    }
}

function getWeekStart(date) {
    const weekStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    )
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day

    weekStart.setDate(weekStart.getDate() + diff)

    return weekStart
}

function formatDateKey(date) {
    const day =
        String(date.getDate())
            .padStart(2, "0")

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0")

    const year =
        date.getFullYear()

    return `${year}-${month}-${day}`
}

function parseDateKey(key) {
    const [year, month, day] =
        key.split("-").map(Number)

    return new Date(year, month - 1, day)
}

function getSalesDateKey(date) {
    const state = getSalesChartState()

    if (state.view === "month") {
        const month =
            String(date.getMonth() + 1)
                .padStart(2, "0")

        return `${date.getFullYear()}-${month}`
    }

    const weekStart =
        formatDateKey(getWeekStart(date))

    if (state.week === "all") {
        return weekStart
    }

    if (state.week !== weekStart) {
        return null
    }

    return formatDateKey(date)
}

function sortSalesDateKeys(first, second) {
    if (first.length === 7 && second.length === 7) {
        return first.localeCompare(second)
    }

    return parseDateKey(first) - parseDateKey(second)
}

function formatSalesDateLabel(key) {
    if (key.length === 7) {
        const [year, month] = key.split("-")

        return `${MONTH_MAP[Number(month)]}/${year}`
    }

    const [year, month, day] = key.split("-")
    const state = getSalesChartState()

    if (state.view === "week" && state.week === "all") {
        const weekStart = parseDateKey(key)
        const weekEnd = parseDateKey(key)

        weekEnd.setDate(weekEnd.getDate() + 6)

        return `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")} a ${String(weekEnd.getDate()).padStart(2, "0")}/${String(weekEnd.getMonth() + 1).padStart(2, "0")}`
    }

    return `${day}/${month}/${year}`
}

function createChannelsChart(data) {

    destroyChart(channelsChart)

    const entries =
        getSplitStatusEntries(data, COLUMN_MAP.canal, 8)

    if (!hasSplitComparisonData(entries)) {
        toggleChartCard("channelsChartCard", false)
        return
    }

    toggleChartCard("channelsChartCard", true)

    channelsChart = createSplitStatusBarChart(
        "channelsChart",
        entries,
        (label, statusType) => openChartRows(
            `Canal: ${label} - ${statusType === "won" ? "Vencemos" : "Perdemos"}`,
            rowsMatchingChartStatus(data, COLUMN_MAP.canal, label, statusType)
        )
    )
}

function createCampaignsChart(data) {

    destroyChart(campaignsChart)

    const entries =
        getSplitStatusEntries(data, COLUMN_MAP.campanha, 8)

    if (!hasSplitComparisonData(entries)) {
        toggleChartCard("campaignsChartCard", false)
        return
    }

    toggleChartCard("campaignsChartCard", true)

    campaignsChart = createSplitStatusBarChart(
        "campaignsChart",
        entries,
        (label, statusType) => openChartRows(
            `Campanha: ${label} - ${statusType === "won" ? "Vencemos" : "Perdemos"}`,
            rowsMatchingChartStatus(data, COLUMN_MAP.campanha, label, statusType)
        )
    )
}

function createLossReasonsChart(data) {

    destroyChart(lossReasonsChart)

    const lostOnly = data.filter(item =>
        STATUS.lost.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = groupBy(
        lostOnly,
        COLUMN_MAP.motivoPerda
    )
    const entries = getTopEntries(grouped, 8)

    if (!hasComparisonData(entries)) {
        toggleChartCard("lossReasonsChartCard", false)
        return
    }

    toggleChartCard("lossReasonsChartCard", true)

    lossReasonsChart = createHorizontalBarChart(
        "lossReasonsChart",
        "Perdas",
        entries,
        CHART_COLORS.rose,
        label => openChartRows(
            `Motivo de perda: ${label}`,
            rowsMatchingChartValue(lostOnly, COLUMN_MAP.motivoPerda, label)
        )
    )
}

function createSalesPerDayChart(data) {

    destroyChart(salesPerDayChart)

    if (!mainDateFiltersSelected()) {
        toggleChartCard("salesPerDayChartCard", false)
        return
    }

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = {}

    wonOnly.forEach(item => {

        const parsedDate =
            extractBestDate(item)

        if (!parsedDate) return

        const key =
            getSalesDateKey(parsedDate)

        if (!key) return

        grouped[key] =
            (grouped[key] || 0) + 1
    })

    const sortedEntries =
        Object.entries(grouped)
            .sort((a, b) => sortSalesDateKeys(a[0], b[0]))

    if (!hasComparisonData(sortedEntries)) {
        toggleChartCard("salesPerDayChartCard", false)
        return
    }

    toggleChartCard("salesPerDayChartCard", true)

    const labels =
        sortedEntries.map(([date]) => formatSalesDateLabel(date))

    const values =
        sortedEntries.map(([_, value]) => value)

    salesPerDayChart = new Chart(
        document.getElementById("salesPerDayChart"),
        {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Vendas",
                    data: values,
                    tension: 0.35,
                    fill: true,
                    borderColor: CHART_COLORS.emerald,
                    backgroundColor: "rgba(5, 150, 105, 0.14)",
                    pointBackgroundColor: "#ffffff",
                    pointBorderColor: CHART_COLORS.emerald,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 3
                }]
            },

            options: {
                ...baseOptions(),
                onClick(event, elements) {
                    if (!elements.length) return

                    const key =
                        sortedEntries[elements[0].index]?.[0]

                    if (!key) return

                    const rows = wonOnly.filter(item => {
                        const parsedDate =
                            extractBestDate(item)

                        return parsedDate && getSalesDateKey(parsedDate) === key
                    })

                    openChartRows(
                        `Vendas em ${formatSalesDateLabel(key)}`,
                        rows
                    )
                },
                onHover(event, elements) {
                    event.native.target.style.cursor =
                        elements.length ? "pointer" : "default"
                },

                plugins: {
                    ...baseOptions().plugins,
                    tooltip: {
                        ...baseOptions().plugins.tooltip,
                        callbacks: {
                            label(context) {
                                return `Vendas: ${context.parsed.y}`
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: {
                            color: CHART_COLORS.muted,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 7
                        },
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },

                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: CHART_COLORS.muted
                        },
                        grid: {
                            color: CHART_COLORS.grid,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        }
                    }
                }
            },
            plugins: [emptyStatePlugin, doughnutValueLabelsPlugin]
        }
    )
}

function createSellersChart(data) {

    destroyChart(sellersChart)

    const card =
        document.getElementById("sellersChartCard")

    const sellerFilter =
        document.getElementById("sellerFilter")

    if (sellerFilter && sellerFilter.value !== "all") {
        if (card) {
            card.classList.add("hidden")
        }

        return
    }

    if (card) {
        card.classList.remove("hidden")
    }

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = groupBy(
        wonOnly,
        COLUMN_MAP.vendedor
    )
    const entries = getTopEntries(grouped, 8)

    if (!hasComparisonData(entries)) {
        toggleChartCard("sellersChartCard", false)
        return
    }

    toggleChartCard("sellersChartCard", true)

    sellersChart = createHorizontalBarChart(
        "sellersChart",
        "Vendas",
        entries,
        CHART_COLORS.blue,
        label => openChartRows(
            `Vendedor: ${label}`,
            rowsMatchingChartValue(wonOnly, COLUMN_MAP.vendedor, label)
        )
    )
}

function createInstallationChart(data) {

    destroyChart(installationChart)

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    let paid = 0
    let free = 0

    wonOnly.forEach(item => {

        if (parseCurrencyNumber(item[COLUMN_MAP.taxaAtivacao]) > 0) {
            paid++;
        } else {
            free++;
        }
    })

    if ([paid, free].filter(value => value > 0).length < 2) {
        toggleChartCard("installationChartCard", false)
        return
    }

    toggleChartCard("installationChartCard", true)

    installationChart = new Chart(
        document.getElementById("installationChart"),
        {
            type: "doughnut",

            data: {
                labels: [
                    "Taxa paga",
                    "Taxa isenta",
                ],

                datasets: [{
                    data: [paid, free],
                    backgroundColor: [
                        CHART_COLORS.emerald,
                        CHART_COLORS.amber,
                    ],
                    borderColor: "#ffffff",
                    borderWidth: 4,
                    hoverOffset: 6
                }]
            },

            options: {
                ...baseOptions(),
                cutout: "68%",
                onClick(event, elements) {
                    if (!elements.length || typeof openProspectList !== "function") {
                        return
                    }

                    const index =
                        elements[0].index

                    openProspectList(
                        index === 0
                            ? "installationPaid"
                            : "installationFree"
                    )
                },
                onHover(event, elements) {
                    event.native.target.style.cursor =
                        elements.length ? "pointer" : "default"
                },
                plugins: {
                    ...baseOptions().plugins,
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            color: CHART_COLORS.text,
                            usePointStyle: true,
                            pointStyle: "circle",
                            padding: 18,
                            font: {
                                size: 12,
                                weight: "600"
                            }
                        }
                    },
                    tooltip: {
                        ...baseOptions().plugins.tooltip,
                        callbacks: {
                            label(context) {
                                const total = context.dataset.data.reduce(
                                    (sum, value) => sum + value,
                                    0
                                )
                                const value = context.parsed
                                const percent = total
                                    ? ((value / total) * 100).toFixed(1)
                                    : "0.0"

                                return `${context.label}: ${value} (${percent}%)`
                            }
                        }
                    }
                }
            },
            plugins: [emptyStatePlugin]
        }
    )
}

function createPlansChart(data) {

    destroyChart(plansChart)

    const card =
        document.getElementById("plansChartCard")

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const wonWithPlan = wonOnly.filter(item => {
        const planId = item[COLUMN_MAP.plano]

        return String(planId || "").trim() !== ""
    })

    if (!wonWithPlan.length) {
        if (card) {
            card.classList.add("hidden")
        }

        return
    }

    if (card) {
        card.classList.remove("hidden")
    }

    const grouped = groupBy(
        wonWithPlan,
        COLUMN_MAP.plano
    )
    const entries = getTopEntries(grouped, 10)

    if (!hasComparisonData(entries)) {
        if (card) {
            card.classList.add("hidden")
        }

        return
    }

    plansChart = createHorizontalBarChart(
        "plansChart",
        "Vendas",
        entries,
        CHART_COLORS.emerald,
        label => openChartRows(
            `Plano: ${label}`,
            rowsMatchingChartValue(wonWithPlan, COLUMN_MAP.plano, label)
        )
    )
}
