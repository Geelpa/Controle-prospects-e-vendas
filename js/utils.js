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

function applyBusinessRules(row) {
    return row
}

function isOwnershipTransferChannel(row) {
    const channelName =
        row[COLUMN_MAP.canal]

    const originChannel =
        row[COLUMN_MAP.canalOrigem]

    return normalize(channelName) === "troca de titularidade" ||
        normalize(originChannel) === "troca de titularidade"
}

function parseCurrencyNumber(value) {
    if (value === undefined || value === null) return 0
    if (typeof value === "number") return value

    const cleanValue = String(value)
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")

    return parseFloat(cleanValue) || 0
}

function parseDate(dateString) {

    if (!dateString) return null

    dateString = String(dateString).trim()

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

        if (columnName === COLUMN_MAP.plano) {
            key = key || "Sem plano"
        }

        if (columnName === COLUMN_MAP.campanha) {
            key = key || "Sem campanha"
        }

        if (columnName === COLUMN_MAP.canal) {
            key = key || "Sem canal"
        }

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

function extractBestDate(row) {

    const possibleDateColumns = Object.keys(row)
        .filter(key =>
            normalize(key)
                .includes("data")
        )

    if (!possibleDateColumns.length) {
        return null
    }

    const validDates = []

    possibleDateColumns.forEach(column => {

        const value = row[column]

        const parsed =
            parseDate(value)

        if (parsed) {
            validDates.push(parsed)
        }
    })

    if (!validDates.length) {
        return null
    }

    validDates.sort((a, b) => b - a)

    return validDates[0]
}
