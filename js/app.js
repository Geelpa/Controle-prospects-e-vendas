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
    const validLeads = won + lost

    const conversion =
        validLeads > 0
            ? ((won / validLeads) * 100).toFixed(1)
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

    createChannelsChart(data)
    createCampaignsChart(data)
    createLossReasonsChart(data)
    createSalesPerDayChart(data)
    createSellersChart(data)
    createInstallationChart(data)
    createPlansChart(data)
}
