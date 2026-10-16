function updateKPIs({
    total,
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
    totalTaxPaid // <-- Adicione aqui nos parâmetros
}) {
    document.getElementById("averageTicket").innerText =
        averageTicket

    document.getElementById("totalProspects").innerText =
        total
    document.getElementById("prospectsDailyAverage").innerText =
        formatDailyKpi(prospectsDailyAverage)

    document.getElementById("wonDeals").innerText =
        won
    document.getElementById("activationsDailyAverage").innerText =
        formatDailyKpi(activationsDailyAverage)

    document.getElementById("lostDeals").innerText =
        lost
    document.getElementById("lostDealsPercent").innerText =
        `${getKpiPercent(lost, total)}% do total`

    document.getElementById("noViabilityDeals").innerText =
        noViability
    document.getElementById("noViabilityDealsPercent").innerText =
        `${getKpiPercent(noViability, total)}% do total`

    document.getElementById("inProgressDeals").innerText =
        inProgress
    document.getElementById("inProgressDealsPercent").innerText =
        `${getKpiPercent(inProgress, total)}% do total`

    document.getElementById("alreadyClientsDeals").innerText = alreadyClients
    document.getElementById("inactiveDeals").innerText = inactive
    document.getElementById("withdrawnDeals").innerText = withdrawn
    document.getElementById("cancelledDeals").innerText = cancelled

    document.getElementById("totalTaxPaid").innerText =
        totalTaxPaid

    document.getElementById("conversionRate").innerText =
        `${conversion}%`
}

function formatDailyKpi(value) {
    return value === null || !Number.isFinite(value)
        ? "Média diária: --"
        : `Média diária: ${value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} / dia`
}

function getKpiPercent(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"
}