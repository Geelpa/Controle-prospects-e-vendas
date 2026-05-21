document
    .getElementById("csvFile")
    .addEventListener("change", handleFileUpload)

document
    .getElementById("sellerFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("monthFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("yearFilter")
    .addEventListener("change", applyFilters)

function processData(data) {

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

    updateKPIs({
        total,
        won,
        lost,
        noViability,
        inProgress,
        conversion
    })

    createChannelsChart(data)
    createCampaignsChart(data)
    createLossReasonsChart(data)
    createSalesPerDayChart(data)
    createSellersChart(data)
    createInstallationChart(data)
}