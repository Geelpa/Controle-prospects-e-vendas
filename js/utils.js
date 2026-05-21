function normalize(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy()
    }
}

function parseDate(dateString) {

    if (!dateString)
        return new Date()

    if (dateString.includes("/")) {

        const parts = dateString.split("/")

        return new Date(
            parts[2],
            parts[1] - 1,
            parts[0]
        )
    }

    return new Date(dateString)
}

function groupBy(data, columnName) {

    const grouped = {}

    data.forEach(item => {

        let key = item[columnName] || "Não informado"

        if (columnName === COLUMN_MAP.campanha) {
            key = CAMPAIGN_MAP[key] || `Campanha ${key}`
        }

        if (columnName === COLUMN_MAP.canal) {
            key = CHANNEL_MAP[key] || `Canal ${key}`
        }

        if (columnName === COLUMN_MAP.vendedor) {
            key = SELLER_MAP[key] || `Vendedor ${key}`
        }

        grouped[key] = (grouped[key] || 0) + 1
    })

    return Object.fromEntries(
        Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
    )
}