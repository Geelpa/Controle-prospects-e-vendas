function updateKPIs({
    total,
    won,
    lost,
    noViability,
    inProgress,
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

    document.getElementById("totalTaxPaid").innerText =
        totalTaxPaid

    document.getElementById("conversionRate").innerText =
        `${conversion}%`
}