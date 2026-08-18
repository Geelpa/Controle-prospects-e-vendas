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

function findColumnName(row, columnName, aliases = []) {
    const candidates = [
        columnName,
        ...aliases
    ].filter(Boolean)

    const columns =
        Object.keys(row || {})

    return candidates.find(candidate =>
        columns.includes(candidate)
    ) || candidates
        .map(candidate =>
            columns.find(column =>
                normalize(column) === normalize(candidate)
            )
        )
        .find(Boolean)
}

function getField(row, columnName, aliases = []) {
    const resolvedColumn =
        findColumnName(row, columnName, aliases)

    return resolvedColumn
        ? row[resolvedColumn]
        : undefined
}

function extractDateFromColumns(row, columnNames) {
    const parsedDates = columnNames
        .map(columnName =>
            parseDate(getField(row, columnName))
        )
        .filter(Boolean)

    if (!parsedDates.length) {
        return null
    }

    return parsedDates[0]
}

function extractRegistrationDate(row) {
    return extractDateFromColumns(row, [
        COLUMN_MAP.data,
        "Data do cadastro",
        "Data cadastro"
    ])
}

function extractActivationDate(row) {
    return extractDateFromColumns(row, [
        COLUMN_MAP.dataAtivacao,
        "Data ativação",
        "Data de ativação",
        "Data ativacao",
        "Data de ativacao",
        "Data Ativação",
        "Data Ativacao"
    ])
}

function getBusinessDateForRow(row) {
    if (!row) return null

    const activationDate = extractActivationDate(row)
    const hasActivationDate = !!activationDate

    const hasWonSignal = (
        typeof isWon === "function" && isWon(row)
    ) || (
        normalize(String(row?.[COLUMN_MAP.status] || "")) === "vencemos"
    ) || (
        String(row?.[COLUMN_MAP.contrato] || "").trim() !== "" &&
        String(row?.[COLUMN_MAP.contrato] || "").trim() !== "-"
    )

    if (hasActivationDate && hasWonSignal) {
        return activationDate
    }

    return extractRegistrationDate(row)
}

function resolveSellerDisplayName(value) {
    if (value === undefined || value === null) return ""

    const rawValue = String(value).trim()

    if (!rawValue || rawValue === "undefined" || rawValue === "null") {
        return ""
    }

    return SELLER_MAP[rawValue] || SELLER_MAP[String(rawValue).replace(/^0+/, "")] || rawValue
}

function getSellerValue(row) {
    const contractSeller = getField(row, COLUMN_MAP.vendedorContrato, [
        "Vendedor Contrato",
        "Vendedor do contrato",
        "Vendedor contrato",
        "Consultor contrato",
        "Vendedor de contrato",
        "Contrato Vendedor"
    ])

    if (contractSeller !== undefined && contractSeller !== null && String(contractSeller).trim() !== "" && String(contractSeller).trim() !== "undefined") {
        return String(contractSeller).trim()
    }

    const responsibleSeller = getField(row, COLUMN_MAP.vendedor, [
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

    if (responsibleSeller !== undefined && responsibleSeller !== null && String(responsibleSeller).trim() !== "" && String(responsibleSeller).trim() !== "undefined") {
        return String(responsibleSeller).trim()
    }

    return ""
}

function getContractSellerValue(row) {
    const contractSeller = getField(row, COLUMN_MAP.vendedorContrato, [
        "Vendedor Contrato",
        "Vendedor do contrato",
        "Vendedor contrato",
        "Consultor contrato",
        "Vendedor de contrato",
        "Contrato Vendedor"
    ])

    if (contractSeller !== undefined && contractSeller !== null && String(contractSeller).trim() !== "" && String(contractSeller).trim() !== "undefined") {
        return String(contractSeller).trim()
    }

    return getSellerValue(row)
}

function groupBy(data, columnName) {

    const grouped = {}

    data.forEach(item => {

        let key = getField(item, columnName)

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
            const sellerValue = getSellerValue(item)
            key = resolveSellerDisplayName(sellerValue) || sellerValue || `Vendedor ${key}`
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
    return extractRegistrationDate(row) ||
        extractActivationDate(row)
}
