function updateKPIs({
    total,
    won,
    lost,
    noViability,
    inProgress,
    conversion
}) {

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

    document.getElementById("conversionRate").innerText =
        `${conversion}%`
}