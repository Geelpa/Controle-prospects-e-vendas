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

    const select =
        document.getElementById("monthFilter")

    select.innerHTML =
        '<option value="all">Todos</option>'

    const months = [
        ...new Set(
            data.map(item => {

                const date = parseDate(
                    item[COLUMN_MAP.data]
                )

                return date.getMonth() + 1
            })
        )
    ]

    months
        .sort((a, b) => a - b)
        .forEach(month => {

            const option = document.createElement("option")

            option.value = month

            option.textContent = MONTH_MAP[month]

            select.appendChild(option)
        })
}

function populateYearFilter(data) {

    const select =
        document.getElementById("yearFilter")

    select.innerHTML =
        '<option value="all">Todos</option>'

    const years = [
        ...new Set(
            data.map(item => {

                const date = parseDate(
                    item[COLUMN_MAP.data]
                )

                return date.getFullYear()
            })
        )
    ]

    years
        .sort((a, b) => a - b)
        .forEach(year => {

            const option = document.createElement("option")

            option.value = year

            option.textContent = year

            select.appendChild(option)
        })
}

function applyFilters() {

    const seller =
        document.getElementById("sellerFilter").value

    const month =
        document.getElementById("monthFilter").value

    const year =
        document.getElementById("yearFilter").value

    const filtered = originalData.filter(item => {

        const date = parseDate(
            item[COLUMN_MAP.data]
        )

        const sellerMatch =
            seller === "all" ||
            item[COLUMN_MAP.vendedor] === seller

        const monthMatch =
            month === "all" ||
            (date.getMonth() + 1).toString() === month

        const yearMatch =
            year === "all" ||
            date.getFullYear().toString() === year

        return (
            sellerMatch &&
            monthMatch &&
            yearMatch
        )
    })

    processData(filtered)
}