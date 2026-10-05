function populateFilters(data) {
    populateMonthFilter(data)
    populateYearFilter(data)
    populateSellerFilter(data)
}

function matchesGlobalSearch(item, query) {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery || normalizedQuery === "todos") return true

    return Object.entries(item || {}).some(([key, value]) =>
        normalize(`${key} ${value}`).includes(normalizedQuery)
    )
}

function populateSellerFilter(data, selectedMonth, selectedYear, preserveSelection = false) {
    const select = document.getElementById("sellerFilter")
    if (!select) return

    const previousSelection = preserveSelection ? select.value : "all"
    const month = selectedMonth ?? document.getElementById("monthFilter")?.value ?? "all"
    const year = selectedYear ?? document.getElementById("yearFilter")?.value ?? "all"
    select.innerHTML = '<option value="all">Todos</option>'

    const salesBySeller = new Map()
    const wonRows = getUniqueWonRows((data || []).filter(isWon))

    wonRows.forEach(item => {
        const activationDate = extractActivationDate(item)
        if (month !== "all" && (!activationDate || activationDate.getMonth() + 1 !== Number(month))) return
        if (year !== "all" && (!activationDate || activationDate.getFullYear() !== Number(year))) return

        const rawSeller = getContractSellerValue(item) || getSellerValue(item)
        const sellerLabel = resolveSellerDisplayName(rawSeller) || rawSeller
        if (!sellerLabel) return

        const sellerKey = normalize(sellerLabel)
        const existing = salesBySeller.get(sellerKey)
        salesBySeller.set(sellerKey, {
            label: existing?.label || sellerLabel,
            count: (existing?.count || 0) + 1
        })
    })

    ;(data || []).forEach(item => {
        const rawSeller = getProspectSellerValue(item)
        const sellerLabel = resolveSellerDisplayName(rawSeller) || rawSeller
        if (!sellerLabel) return

        const registrationDate = extractRegistrationDate(item)
        if (month !== "all" && (!registrationDate || registrationDate.getMonth() + 1 !== Number(month))) return
        if (year !== "all" && (!registrationDate || registrationDate.getFullYear() !== Number(year))) return

        const sellerKey = normalize(sellerLabel)
        if (!sellerKey || salesBySeller.has(sellerKey)) return

        salesBySeller.set(sellerKey, { label: sellerLabel, count: 0 })
    })

    Array.from(salesBySeller.values())
        .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "pt-BR"))
        .forEach(({ label }) => {
            const option = document.createElement("option")
            option.value = label
            option.textContent = label
            select.appendChild(option)
        })

    select.value = Array.from(select.options).some(option => option.value === previousSelection)
        ? previousSelection
        : "all"
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
    const month =
        document.getElementById("monthFilter").value

    const year =
        document.getElementById("yearFilter").value
    populateSellerFilter(rawData, month, year, true)
    const seller = document.getElementById("sellerFilter").value
    const globalSearch =
        document.getElementById("globalSearch")?.value || ""
    // Build two filtered datasets:
    // 1) prospectFilteredData: used for prospect KPIs (based on registration date)
    // 2) salesFilteredData: used for wins/activations/charts (based on business/activation date)

    const prospectFilteredData = rawData.filter(item => {
        if (!matchesGlobalSearch(item, globalSearch)) return false
        // seller match
        const sellerMatch =
            seller === "all" ||
            normalize(resolveSellerDisplayName(getProspectSellerValue(item) || getField(item, COLUMN_MAP.vendedor))) === normalize(String(seller))

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
        if (!matchesGlobalSearch(item, globalSearch)) return false
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

    updateSalesChartFilters([
        ...salesFilteredData,
        ...prospectFilteredData
    ], month)

    processData(prospectFilteredData, salesFilteredData)
}

function updateSalesChartFilters(data, selectedMonth) {
    const viewFilter = document.getElementById("salesViewFilter")
    const weekFilter = document.getElementById("weekFilter")
    const title = document.getElementById("salesChartTitle")
    if (!viewFilter || !weekFilter) return

    viewFilter.disabled = false

    if (viewFilter.value === "month") {
        weekFilter.classList.add("hidden")
        if (title) title.textContent = "Resultados por Mês"
        return
    }

    if (viewFilter.value === "week") {
        weekFilter.classList.add("hidden")
        if (title) title.textContent = "Resultados por Semana"
        return
    }

    populateWeekFilter(data)
    weekFilter.classList.remove("hidden")
    if (title) {
        title.textContent = "Resultados por Dia"
    }
}

function populateWeekFilter(data) {
    const weekFilter =
        document.getElementById("weekFilter")

    const currentValue =
        weekFilter.value

    weekFilter.innerHTML =
        '<option value="all">Todas as semanas</option>'

    const weekStarts = new Set()

    data.forEach(item => {
        const parsedDate = isWon(item)
            ? extractActivationDate(item)
            : extractRegistrationDate(item)

        if (parsedDate) weekStarts.add(formatDateKey(getWeekStart(parsedDate)))
    })

    const sortedWeekStarts = [...weekStarts]
        .sort((a, b) => parseDateKey(a) - parseDateKey(b))

    sortedWeekStarts.forEach(weekStart => {
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
    } else {
        weekFilter.value = "all"
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

document
    .getElementById("globalSearch")
    .addEventListener("input", applyFilters)
