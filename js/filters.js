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
}

function applyFilters() {



    const seller =
        document.getElementById("sellerFilter").value

    const month =
        document.getElementById("monthFilter").value

    const year =
        document.getElementById("yearFilter").value

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

    processData(filteredData)
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