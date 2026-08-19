function populateFilters(data) {

    populateSellerFilter(data)
    populateMonthFilter(data)
    populateYearFilter(data)
}

function populateSellerFilter(data) {

    const select = document.getElementById("sellerFilter")

    if (!select) return

    const hasSellerActivity = (item) => {
        const responsibleSeller = getField(item, COLUMN_MAP.vendedor, [
            "Vendedor",
            "Vendedor Prospect",
            "Vendedor prospect",
            "Vendedor do prospect",
            "Vendedor Comercial",
            "Vendedor comercial",
            "Vendedor responsável",
            "Responsável",
            "Responsavel",
            "Vendor",
            "Consultor"
        ])

        const rawSeller = responsibleSeller ?? getSellerValue(item)

        if (!rawSeller) return false

        const sellerValue = String(rawSeller).trim()
        if (!sellerValue || sellerValue === "undefined" || sellerValue === "null") return false

        const hasKnownSellerId = !/^\d+$/.test(sellerValue) || !!resolveSellerDisplayName(sellerValue)
        if (!hasKnownSellerId) return false

        const status = normalize(item?.[COLUMN_MAP.status])
        const hasStatusMatch = status && (
            STATUS.won.includes(status) ||
            STATUS.lost.includes(status) ||
            STATUS.noViability.includes(status) ||
            STATUS.inProgress.includes(status)
        )

        const contractValue = String(item?.[COLUMN_MAP.contrato] || item?.["Contrato Gerado"] || item?.Contrato || "").trim()
        const hasContract = contractValue !== "" && contractValue !== "-"

        const hasRevenue = parseCurrencyNumber(item?.[COLUMN_MAP.valorContrato] || item?.["Valor contrato"] || item?.["Valor do contrato"] || 0) > 0

        return hasStatusMatch || hasContract || hasRevenue
    }

    select.innerHTML = '<option value="all">Todos</option>'

    const uniqueSellers = new Map()

    data.forEach(item => {
        if (!hasSellerActivity(item)) return

        const rawValue = String(getSellerValue(item)).trim()
        const sellerLabel = resolveSellerDisplayName(rawValue) || rawValue

        if (/^\d+$/.test(rawValue) && sellerLabel === rawValue) return

        const sellerKey = normalize(sellerLabel)
        if (!sellerKey) return

        if (!uniqueSellers.has(sellerKey)) {
            uniqueSellers.set(sellerKey, sellerLabel)
        }
    })

    Array.from(uniqueSellers.values())
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach(sellerLabel => {
            const option = document.createElement("option")
            option.value = sellerLabel
            option.textContent = sellerLabel
            select.appendChild(option)
        })
}

function populateMonthFilter(data) {

    const monthFilter =
        document.getElementById("monthFilter")

    monthFilter.innerHTML =
        `<option value="all">Todos</option>`

    const months = [

        ...new Set(

            data
                .map(item => {

                    const parsedDate =
                        getBusinessDateForRow(item)

                    // IGNORA DATAS INVÁLIDAS
                    if (!parsedDate) return null

                    return parsedDate.getMonth() + 1
                })

                .filter(Boolean)
        )

    ].sort((a, b) => a - b)

    months.forEach(month => {

        const option =
            document.createElement("option")

        option.value = month

        option.textContent =
            MONTH_MAP[month]

        monthFilter.appendChild(option)
    })

    // Seleciona por padrão o mês atual se estiver presente nos dados
    const currentMonth = new Date().getMonth() + 1
    if (months.includes(currentMonth)) {
        monthFilter.value = String(currentMonth)
    } else {
        monthFilter.value = "all"
    }
}

function populateYearFilter(data) {

    const yearFilter =
        document.getElementById("yearFilter")

    yearFilter.innerHTML =
        `<option value="all">Todos</option>`

    const years = [

        ...new Set(

            data
                .map(item => {

                    const parsedDate =
                        getBusinessDateForRow(item)

                    // IGNORA DATAS INVÁLIDAS
                    if (!parsedDate) return null

                    return parsedDate.getFullYear()
                })

                .filter(Boolean)
        )

    ].sort((a, b) => b - a)

    years.forEach(year => {

        const option =
            document.createElement("option")

        option.value = year
        option.textContent = year

        yearFilter.appendChild(option)
    })

    // Seleciona por padrão o ano atual se presente nos dados
    const currentYear = new Date().getFullYear()
    if (years.includes(currentYear)) {
        yearFilter.value = String(currentYear)
    } else {
        yearFilter.value = "all"
    }
}

function applyFilters() {



    const seller =
        document.getElementById("sellerFilter").value

    const month =
        document.getElementById("monthFilter").value

    const year =
        document.getElementById("yearFilter").value
    const salesViewFilter =
        document.getElementById("salesViewFilter")

    if (salesViewFilter) {
        salesViewFilter.dataset.autoMode =
            month === "all" ? "month" : "week"
    }

    // Build two filtered datasets:
    // 1) prospectFilteredData: used for prospect KPIs (based on registration date)
    // 2) salesFilteredData: used for wins/activations/charts (based on business/activation date)

    const prospectFilteredData = rawData.filter(item => {
        // seller match
        const sellerMatch =
            seller === "all" ||
            normalize(resolveSellerDisplayName(getSellerValue(item))) === normalize(String(seller))

        if (!sellerMatch) return false

        if (month === "all" && year === "all") return true

        const regDate = extractRegistrationDate(item)
        if (!regDate) return false

        const itemMonth = regDate.getMonth() + 1
        const itemYear = regDate.getFullYear()

        const monthMatch = month === "all" || itemMonth === Number(month)
        const yearMatch = year === "all" || itemYear === Number(year)

        return monthMatch && yearMatch
    })

    const salesFilteredData = rawData.filter(item => {
        // seller match
        const sellerMatch =
            seller === "all" ||
            normalize(resolveSellerDisplayName(getSellerValue(item))) === normalize(String(seller))

        if (!sellerMatch) return false

        if (month === "all" && year === "all") return true

        const parsedDate = getBusinessDateForRow(item)
        if (!parsedDate) return false

        const itemMonth = parsedDate.getMonth() + 1
        const itemYear = parsedDate.getFullYear()

        const monthMatch = month === "all" || itemMonth === Number(month)
        const yearMatch = year === "all" || itemYear === Number(year)

        return monthMatch && yearMatch
    })

    updateSalesChartFilters(salesFilteredData, month)

    processData(prospectFilteredData, salesFilteredData)
}

function updateSalesChartFilters(data, selectedMonth) {
    const salesViewFilter =
        document.getElementById("salesViewFilter")

    const weekFilter =
        document.getElementById("weekFilter")

    const salesChartTitle =
        document.getElementById("salesChartTitle")

    if (!salesViewFilter || !weekFilter) return

    if (selectedMonth === "all") {
        salesViewFilter.value = "month"
        salesViewFilter.disabled = true
        weekFilter.classList.add("hidden")
        weekFilter.value = "all"

        if (salesChartTitle) {
            salesChartTitle.textContent = "Ativações por Mês"
        }

        return
    }

    if (salesViewFilter.dataset.autoMode === "week") {
        salesViewFilter.value = "week"
    }

    salesViewFilter.disabled = false

    if (salesViewFilter.value === "month") {
        weekFilter.classList.add("hidden")
        weekFilter.value = "all"

        if (salesChartTitle) {
            salesChartTitle.textContent = "Ativações por Mês"
        }

        return
    }

    populateWeekFilter(data)
    weekFilter.classList.remove("hidden")

    if (salesChartTitle) {
        salesChartTitle.textContent =
            weekFilter.value === "all"
                ? "Ativações por Semana"
                : "Ativações por Dia"
    }
}

function populateWeekFilter(data) {
    const weekFilter =
        document.getElementById("weekFilter")

    const currentValue =
        weekFilter.value

    weekFilter.innerHTML =
        '<option value="all">Todas as semanas</option>'

    const weekStarts = [
        ...new Set(
            data
                .filter(item =>
                    STATUS.won.includes(
                        normalize(item[COLUMN_MAP.status])
                    )
                )
                .map(item => {
                    const parsedDate =
                        extractActivationDate(item)

                    if (!parsedDate) return null

                    return formatDateKey(getWeekStart(parsedDate))
                })
                .filter(Boolean)
        )
    ].sort((a, b) => parseDateKey(a) - parseDateKey(b))

    weekStarts.forEach(weekStart => {
        const startDate = parseDateKey(weekStart)
        const endDate = parseDateKey(weekStart)

        endDate.setDate(endDate.getDate() + 6)

        const option =
            document.createElement("option")

        option.value = weekStart
        option.textContent =
            `${formatShortDate(startDate)} a ${formatShortDate(endDate)}`

        weekFilter.appendChild(option)
    })

    if ([...weekFilter.options].some(option => option.value === currentValue)) {
        weekFilter.value = currentValue
    }
}

function formatShortDate(date) {
    const day =
        String(date.getDate())
            .padStart(2, "0")

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0")

    return `${day}/${month}`
}

document
    .getElementById("sellerFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("monthFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("yearFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("salesViewFilter")
    .addEventListener("change", applyFilters)

document
    .getElementById("weekFilter")
    .addEventListener("change", applyFilters)
