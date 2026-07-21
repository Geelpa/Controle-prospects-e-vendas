function populateFilters(data) {

    populateSellerFilter(data)
    populateMonthFilter(data)
    populateYearFilter(data)
}

function populateSellerFilter(data) {

    const select =
        document.getElementById("sellerFilter")

    select.innerHTML =
        '<option value="all">Todos</option>'

    const sellers = [
        ...new Set(
            data.map(item => item[COLUMN_MAP.vendedor])
        )
    ]

    sellers.forEach(id => {

        const option = document.createElement("option")

        option.value = id

        option.textContent =
            SELLER_MAP[id] || `Vendedor ${id}`

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
                        extractBestDate(item)

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
                        extractBestDate(item)

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

    const filteredData = rawData.filter(item => {

        // DATA
        const parsedDate =
            extractBestDate(item)

        // IGNORA DATAS INVÁLIDAS
        if (!parsedDate) return false

        const itemMonth =
            parsedDate.getMonth() + 1

        const itemYear =
            parsedDate.getFullYear()

        // VENDEDOR
        const sellerMatch =

            seller === "all" ||

            String(item[COLUMN_MAP.vendedor]) ===
            String(seller)

        // MÊS
        const monthMatch =

            month === "all" ||

            itemMonth === Number(month)

        // ANO
        const yearMatch =

            year === "all" ||

            itemYear === Number(year)

        return (
            sellerMatch &&
            monthMatch &&
            yearMatch
        )
    })

    updateSalesChartFilters(filteredData, month)

    processData(filteredData)
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
            salesChartTitle.textContent = "Vendas por Mês"
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
            salesChartTitle.textContent = "Vendas por Mês"
        }

        return
    }

    populateWeekFilter(data)
    weekFilter.classList.remove("hidden")

    if (salesChartTitle) {
        salesChartTitle.textContent =
            weekFilter.value === "all"
                ? "Vendas por Semana"
                : "Vendas por Dia"
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
                        extractBestDate(item)

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
