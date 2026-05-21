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

    if (!dateString) return null

    // REMOVE ESPAÇOS
    dateString = String(dateString).trim()

    // FORMATO:
    // dd/mm/yyyy
    // dd/mm/yyyy hh:mm:ss

    const [datePart] =
        dateString.split(" ")

    const parts =
        datePart.split("/")

    if (parts.length !== 3) {
        return null
    }

    const day =
        parseInt(parts[0], 10)

    const month =
        parseInt(parts[1], 10) - 1

    const year =
        parseInt(parts[2], 10)

    return new Date(
        year,
        month,
        day
    )
}

function groupBy(data, columnName) {

    const grouped = {}

    data.forEach(item => {

        let key = item[columnName]

        // PLANOS
        if (columnName === COLUMN_MAP.plano) {

            // SE VIER ID
            if (PLAN_MAP[key]) {

                key = PLAN_MAP[key].name

            } else {

                // SE JÁ VIER NOME
                key = key || "Sem plano"
            }
        }

        // CAMPANHAS
        if (columnName === COLUMN_MAP.campanha) {

            key =
                CAMPAIGN_MAP[key] ||
                `Campanha ${key}`
        }

        // CANAIS
        if (columnName === COLUMN_MAP.canal) {

            key =
                CHANNEL_MAP[key] ||
                `Canal ${key}`
        }

        // VENDEDORES
        if (columnName === COLUMN_MAP.vendedor) {

            key =
                SELLER_MAP[key] ||
                `Vendedor ${key}`
        }

        grouped[key] =
            (grouped[key] || 0) + 1
    })

    return Object.fromEntries(

        Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
    )
}