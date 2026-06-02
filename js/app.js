function processData(data) {
    currentFilteredData = data

    const total = data.length

    const won = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    ).length

    const lost = data.filter(item =>
        STATUS.lost.includes(
            normalize(item[COLUMN_MAP.status])
        )
    ).length

    const noViability = data.filter(item =>
        STATUS.noViability.includes(
            normalize(item[COLUMN_MAP.status])
        )
    ).length

    const inProgress = data.filter(item =>
        STATUS.inProgress.includes(
            normalize(item[COLUMN_MAP.status])
        )
    ).length

    // CONVERSÃO REAL
    const workableSales = data.filter(item =>
        isWorkableSaleStatus(item)
    ).length

    const conversion =
        workableSales > 0
            ? ((won / workableSales) * 100).toFixed(1)
            : 0

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    let totalRevenue = 0

    wonOnly.forEach(item => {

        const planId =
            item[COLUMN_MAP.plano]

        let price = 0

        // SE VIER ID
        if (PLAN_MAP[planId]) {

            price = PLAN_MAP[planId].price

        } else {

            // SE VIER NOME
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

        // if (plan) {
        //     totalRevenue += plan.price
        // }
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

    renderPodiums(data)

    createChannelsChart(data)
    createCampaignsChart(data)
    createLossReasonsChart(data)
    createSalesPerDayChart(data)
    createSellersChart(data)
    createInstallationChart(data)
    createPlansChart(data)
}

function renderPodiums(data) {
    const rankingGroups =
        getPodiumRankingGroups(data)

    const bestItems =
        rankingGroups
            .map(group => {
                const first =
                    group.entries[0]

                if (!first) return null

                return {
                    title: group.title,
                    label: first[0],
                    value: first[1],
                    unit: group.unit
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)

    renderPodiumList("bestPodiumList", bestItems)
}

function getPodiumRankingGroups(data) {
    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const wonWithPlan = wonOnly.filter(item =>
        String(item[COLUMN_MAP.plano] || "").trim() !== ""
    )

    const lostOnly = data.filter(item =>
        STATUS.lost.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    return [
        {
            title: "Planos",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonWithPlan, COLUMN_MAP.plano), 10)
        },
        {
            title: "Vendedores",
            unit: "vendas",
            entries: getRankingEntries(groupBy(wonOnly, COLUMN_MAP.vendedor), 8)
        },
        {
            title: "Canais",
            unit: "leads",
            entries: getRankingEntries(groupBy(data, COLUMN_MAP.canal), 8)
        },
        {
            title: "Campanhas",
            unit: "leads",
            entries: getRankingEntries(groupBy(data, COLUMN_MAP.campanha), 8)
        },
        {
            title: "Motivos de Perda",
            unit: "perdas",
            entries: getRankingEntries(groupBy(lostOnly, COLUMN_MAP.motivoPerda), 8)
        }
    ]
}

function isWorkableSaleStatus(item) {
    const status =
        normalize(item[COLUMN_MAP.status])

    return STATUS.won.includes(status) ||
        STATUS.lost.includes(status)
}

function getRankingEntries(grouped, limit) {
    return Object.entries(grouped)
        .filter(([label, value]) =>
            label &&
            normalize(label) !== "undefined" &&
            Number(value) > 0
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
}

function renderPodiumList(containerId, items) {
    const container =
        document.getElementById(containerId)

    if (!container) return

    container.innerHTML = ""

    if (!items.length) {
        const empty = document.createElement("p")

        empty.className = "text-xs text-slate-300"
        empty.textContent = "Sem dados suficientes para este filtro."

        container.appendChild(empty)
        return
    }

    items.forEach((item, index) => {
        const card = document.createElement("div")
        const rank = document.createElement("div")
        const content = document.createElement("div")
        const title = document.createElement("p")
        const label = document.createElement("p")
        const value = document.createElement("p")

        card.className = "bg-green-500 rounded-lg px-3 py-2 flex gap-2.5 items-center min-w-0"
        rank.className = "shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold bg-green-600 text-white"
        content.className = "min-w-0 flex-1"
        title.className = "text-[12px] font-semibold text-white uppercase tracking-wide leading-tight text-green-950"
        label.className = "text-[16px] font-semibold text-white truncate leading-tight"
        value.className = "text-xs font-semibold text-green-950 leading-tight"

        rank.textContent = `${index + 1}º`
        title.textContent = item.title
        label.textContent = item.label
        value.textContent = `${item.value} ${item.unit}`

        content.appendChild(title)
        content.appendChild(label)
        content.appendChild(value)

        card.appendChild(rank)
        card.appendChild(content)

        container.appendChild(card)
    })
}
