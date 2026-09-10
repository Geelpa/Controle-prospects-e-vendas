function updateKPIs({
    total,
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

    document.getElementById("wonDeals").innerText =
        won

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

function getKpiPercent(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"
}