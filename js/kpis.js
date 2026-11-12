let activeKpiTooltipCard = null
let kpiFloatingTooltip

function initKpiFloatingTooltips() {
    kpiFloatingTooltip = document.getElementById("kpiFloatingTip")
    if (!kpiFloatingTooltip) throw new Error("Popover dos KPIs não encontrado")

    document.querySelectorAll("[data-kpi-tooltip]").forEach(card => {
        card.setAttribute("aria-describedby", "kpiFloatingTip")
        card.addEventListener("pointerenter", () => showKpiFloatingTooltip(card))
        card.addEventListener("pointerleave", hideKpiFloatingTooltip)
        card.addEventListener("focus", () => showKpiFloatingTooltip(card))
        card.addEventListener("blur", hideKpiFloatingTooltip)
        card.addEventListener("keydown", event => {
            if (event.key === "Escape") hideKpiFloatingTooltip()
        })
    })

    window.addEventListener("resize", repositionKpiFloatingTooltip)
    window.addEventListener("scroll", repositionKpiFloatingTooltip, true)
}

function showKpiFloatingTooltip(card) {
    activeKpiTooltipCard = card
    renderKpiFloatingTooltip(card)
    kpiFloatingTooltip.setAttribute("aria-hidden", "false")
    kpiFloatingTooltip.classList.add("is-visible")
    repositionKpiFloatingTooltip()
}

function hideKpiFloatingTooltip() {
    if (!kpiFloatingTooltip) return
    kpiFloatingTooltip.classList.remove("is-visible")
    kpiFloatingTooltip.setAttribute("aria-hidden", "true")
    activeKpiTooltipCard = null
}

function repositionKpiFloatingTooltip() {
    if (!activeKpiTooltipCard || !kpiFloatingTooltip.classList.contains("is-visible")) return

    const margin = 12
    const gap = 10
    const cardRect = activeKpiTooltipCard.getBoundingClientRect()
    const tooltipRect = kpiFloatingTooltip.getBoundingClientRect()
    const left = Math.max(
        margin,
        Math.min(
            cardRect.left + cardRect.width / 2 - tooltipRect.width / 2,
            window.innerWidth - tooltipRect.width - margin
        )
    )
    const below = cardRect.bottom + gap
    const top = below + tooltipRect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, cardRect.top - tooltipRect.height - gap)

    kpiFloatingTooltip.style.left = `${left}px`
    kpiFloatingTooltip.style.top = `${top}px`
}

function renderKpiFloatingTooltip(card) {
    const title = card.querySelector("p")?.textContent.trim() || "Indicador"
    const value = card.querySelector("h2")?.textContent.trim() || "--"
    const details = Array.from(card.querySelectorAll("p"))
        .slice(1)
        .map(element => element.textContent.trim())
        .filter(Boolean)

    kpiFloatingTooltip.replaceChildren()
    appendKpiTooltipText("div", "VISÃO RÁPIDA", "kpi-tip-label")
    appendKpiTooltipText("div", title, "kpi-tip-title")
    appendKpiTooltipText("div", value, "kpi-tip-value")

    if (card.dataset.kpiKind === "conversion") {
        appendConversionTooltipDetails(card)
    } else {
        details.forEach(detail => appendKpiTooltipText("p", detail, "kpi-tip-detail"))
    }

    if (card.hasAttribute("data-drilldown")) {
        appendKpiTooltipText("div", "Clique para explorar os registros deste indicador.", "kpi-tip-footer")
    }
}

function appendConversionTooltipDetails(card) {
    const quality = card.dataset.conversionQuality || "Sem resultados para avaliar"
    const rate = card.dataset.conversionRate || "--"
    const period = card.dataset.conversionPeriod || "Todos os meses e anos"
    const wins = Number(card.dataset.conversionWins || 0)
    const losses = Number(card.dataset.conversionLosses || 0)
    const meter = document.createElement("div")
    meter.className = "kpi-tip-meter"
    meter.setAttribute("aria-hidden", "true")

    ;["40%", "10%", "10%", "10%", "30%"].forEach((width, index) => {
        const segment = document.createElement("span")
        segment.style.width = width
        segment.style.backgroundColor = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"][index]
        meter.appendChild(segment)
    })

    if (card.dataset.conversionRate !== undefined && card.dataset.conversionRate !== "") {
        const marker = document.createElement("span")
        marker.className = "kpi-tip-marker"
        marker.style.left = `${Math.max(0, Math.min(100, Number(card.dataset.conversionRate)))}%`
        meter.appendChild(marker)
    }

    appendKpiTooltipText("div", `Saúde: ${quality}`, "kpi-tip-detail")
    const meterWrapper = document.createElement("div")
    meterWrapper.style.position = "relative"
    meterWrapper.appendChild(meter)
    kpiFloatingTooltip.appendChild(meterWrapper)
    appendKpiTooltipText("p", `Período: ${period}.`, "kpi-tip-detail")
    appendKpiTooltipText("p", wins + losses > 0
        ? `${wins} ativações no mês pela data de ativação + ${losses} perdas pela data de cadastro.`
        : "Sem Vencemos ou Perdemos no período.", "kpi-tip-detail")
}

function appendKpiTooltipText(tagName, text, className) {
    const element = document.createElement(tagName)
    element.className = className
    element.textContent = text
    kpiFloatingTooltip.appendChild(element)
}

function updateKPIs({
    total,
    validProspects,
    prospectsDailyAverage,
    activationsDailyAverage,
    won,
    lost,
    conversionWins,
    conversionLosses,
    aborted,
    noViability,
    generalLosses,
    inProgress,
    alreadyClients,
    cancelled,
    conversion,
    averageTicket,
    totalTaxPaid // <-- Adicione aqui nos parâmetros
}) {
    document.getElementById("averageTicket").innerText =
        averageTicket

    document.getElementById("totalProspects").innerText =
        total
    document.getElementById("validProspects").innerText =
        `Prospects válidos: ${validProspects}`
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

    document.getElementById("abortedDealsBelowLost").innerText = aborted

    document.getElementById("noViabilityDeals").innerText =
        noViability
    document.getElementById("noViabilityDealsPercent").innerText =
        `${getKpiPercent(noViability, total)}% do total`

    document.getElementById("inProgressDeals").innerText =
        inProgress
    document.getElementById("inProgressDealsPercent").innerText =
        `${getKpiPercent(inProgress, total)}% do total`

    document.getElementById("alreadyClientsDeals").innerText = alreadyClients
    document.getElementById("generalLossesDeals").innerText = generalLosses
    document.getElementById("cancelledDeals").innerText = cancelled

    document.getElementById("totalTaxPaid").innerText =
        totalTaxPaid

    document.getElementById("conversionRate").innerText =
        `${conversion.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })}%`
    updateConversionTooltip(conversionWins, conversionLosses, conversion)
}

function updateConversionQuality(value, idPrefix) {
    const scale = document.getElementById(`${idPrefix}Scale`)
    const marker = document.getElementById(`${idPrefix}Marker`)
    if (!scale || !marker) {
        throw new Error(`Elementos da escala de qualidade da conversão ausentes: ${idPrefix}`)
    }

    if (!Number.isFinite(value)) {
        scale.hidden = true
        marker.hidden = true
        scale.setAttribute("aria-label", "Sem resultados para avaliar a qualidade da conversão")
        return
    }

    const quality = getConversionQuality(value)
    const formattedValue = `${value.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`

    scale.hidden = false
    marker.hidden = false
    marker.style.left = `${Math.max(0, Math.min(100, value))}%`
    scale.setAttribute(
        "aria-label",
        `Conversão: ${formattedValue}. ${quality.name}, ${quality.range}.`
    )
}

function getConversionQuality(value) {
    if (value < 40) return { name: "Zona crítica", range: "0–39,9%" }
    if (value < 50) return { name: "Zona de atenção", range: "40–49,9%" }
    if (value < 60) return { name: "Zona satisfatória", range: "50–59,9%" }
    if (value < 70) return { name: "Zona de excelência", range: "60–69,9%" }
    return { name: "Zona de alta performance", range: "70%+" }
}

function updateConversionTooltip(wins, losses, conversion) {
    const card = document.getElementById("conversionKpi")
    if (!card) throw new Error("Card de conversão não encontrado")

    const conversionQuality = Number.isFinite(conversion)
        ? getConversionQuality(conversion)
        : null
    const quality = conversionQuality
        ? `${conversionQuality.name} (${conversionQuality.range})`
        : "Sem resultados para avaliar"
    const formattedConversion = Number.isFinite(conversion)
        ? `${conversion.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
        : "--"
    const filterPeriod = ["monthFilter", "yearFilter", "sellerFilter"].flatMap(id => {
        const filter = document.getElementById(id)
        if (!filter || !filter.value || filter.value === "all") return []
        return [filter.options[filter.selectedIndex]?.textContent || filter.value]
    }).join("/")
    const search = document.getElementById("globalSearch")?.value.trim()
    const periodDetail = [
        filterPeriod || "Todos os meses e anos",
        search ? `Busca: ${search}` : ""
    ].filter(Boolean).join(" · ")

    card.dataset.conversionQuality = quality
    card.dataset.conversionRate = Number.isFinite(conversion) ? String(conversion) : ""
    card.dataset.conversionPeriod = periodDetail
    card.dataset.conversionWins = String(wins)
    card.dataset.conversionLosses = String(losses)
    card.setAttribute(
        "aria-label",
        `Conversão: ${formattedConversion}. Saúde: ${quality}. Período: ${periodDetail}.`
    )
    if (activeKpiTooltipCard === card) renderKpiFloatingTooltip(card)
}

initKpiFloatingTooltips()

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