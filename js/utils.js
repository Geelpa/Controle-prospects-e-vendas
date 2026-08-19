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
    if (!row) return row

    // Work on a shallow copy to avoid surprising side-effects
    const newRow = { ...row }

    // Resolve column names present in the row (handles different header aliases)
    const canalCol = findColumnName(row, COLUMN_MAP.canal)
    const campCol = findColumnName(row, COLUMN_MAP.campanha)
    const statusCol = findColumnName(row, COLUMN_MAP.status)
    const contractCol = findColumnName(row, COLUMN_MAP.contrato)

    const canalVal = canalCol ? String(row[canalCol] || "").trim() : ""
    const campVal = campCol ? String(row[campCol] || "").trim() : ""
    const statusVal = statusCol ? String(row[statusCol] || "").trim() : ""
    const contractVal = contractCol ? String(row[contractCol] || "").trim() : ""

    // Normalizar canais vagos/sem resposta para 'Outros'
    const canalNormalize = normalize(canalVal)
    const canaisOutros = [
        "sem canal",
        "cliente não informou",
        "cliente nao informou",
        "não interagiu",
        "nao interagiu",
        "esqueci de perguntar",
        "esqueci de perguntar "
    ]

    if (canalCol && canalNormalize && canaisOutros.includes(canalNormalize)) {
        newRow[canalCol] = "Outros"
    }

    // Rule: if canal de venda é 'troca de titularidade', preencher campanha com o mesmo nome
    if (canalVal && normalize(canalVal) === "troca de titularidade" && campCol) {
        newRow[campCol] = canalVal
    }

    // Rule: se campanha é 'troca de titularidade', preencher canal com 'troca de titularidade'
    if (campVal && normalize(campVal) === "troca de titularidade" && canalCol) {
        newRow[canalCol] = campVal || "Troca de Titularidade"
    }

    // Rule: se status estiver como 'novo' e contrato ativo, ajustar status para 'Vencemos'
    const hasContractActive = contractVal !== "" && contractVal !== "-"
    if (statusVal && normalize(statusVal) === "novo" && hasContractActive && statusCol) {
        newRow[statusCol] = "Vencemos"
    }

    return newRow
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

// Normaliza nomes de plano para evitar variações que representam a mesma configuração
function resolvePlanDisplayName(value) {
    if (value === undefined || value === null) return ""

    const raw = String(value).trim()
    if (!raw) return ""

    const lower = raw.toLowerCase()

    // Checa mapeamento direto primeiro (arquivo js/maps/plans.js)
    try {
        if (typeof PLAN_MAP !== 'undefined') {
            const direct = PLAN_MAP[raw] || PLAN_MAP[lower] || PLAN_MAP[String(raw).replace(/^0+/, '')]
            if (direct) return direct
        }
    } catch (e) { /* ignore if PLAN_MAP not present */ }

    // Regras específicas solicitadas:
    // 300Mb em dobro => Plus - 600Mb
    if (/300\s*mb/.test(lower) && /dobro/.test(lower)) return 'Plus - 600Mb'

    // 400Mb em dobro => Power - 800Mb
    if (/400\s*mb/.test(lower) && /dobro/.test(lower)) return 'Power - 800Mb'

    // Plano Adicional 200Mb em DOBRO VPU - PF => Adicional Start - 500Mb
    // if (/200\s*mb/.test(lower) && /dobro/.test(lower) && /adicional/.test(lower)) return 'Adicional Start - 500Mb'

    // Outras variações contendo "em dobro" com números próximos
    const mDobro = lower.match(/(\d{2,4})\s*mb.*dobro/)
    if (mDobro) {
        const num = Number(mDobro[1])
        if (num === 300) return 'Plus - 600Mb'
        if (num === 400) return 'Power - 800Mb'
        // if (num === 200) return 'Adicional Start - 500Mb'
    }

    // NOVAS REGRAS PME
    // Mapear variações PME/Empresarial para nomes compactos
    if (/pme/.test(lower) || /empresari/.test(lower)) {
        // 400Mb PME
        if (/400\s*mb/.test(lower)) return '400Mb - PME'
        // 1Gb PME
        if (/1\s*gb/.test(lower) || /1gb/.test(lower)) return '1Gb + mesh - PME'
        // 200Mb PME
        if (/200\s*mb/.test(lower)) return '200Mb - PME'
    }

    // Sem mapeamento específico, retorna o texto original mas trimmed
    return raw
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
            // Normaliza o nome do plano antes de agrupar para evitar variações que representam o mesmo produto
            key = resolvePlanDisplayName(key) || key || "Sem plano"
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
