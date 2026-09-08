function updateKPIs({
    total,
    won,
    lost,
    noViability,
    inProgress,
    preContract,
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

    document.getElementById("noViabilityDeals").innerText =
        noViability

    document.getElementById("inProgressDeals").innerText =
        inProgress

    document.getElementById("preContractDeals").innerText = preContract
    document.getElementById("inactiveDeals").innerText = inactive
    document.getElementById("withdrawnDeals").innerText = withdrawn
    document.getElementById("cancelledDeals").innerText = cancelled

    document.getElementById("totalTaxPaid").innerText =
        totalTaxPaid

    document.getElementById("conversionRate").innerText =
        `${conversion}%`
}