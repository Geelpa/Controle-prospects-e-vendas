let uploadedCsvFiles = []

document
    .getElementById("csvFile")
    .addEventListener("change", handleFile)

function normalizeCsvText(value) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
}

function parseCurrencyLike(value) {
    if (value === undefined || value === null || normalizeCsvText(value) === "") return 0

    const clean = normalizeCsvText(value)
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")

    const parsed = Number.parseFloat(clean)
    return Number.isFinite(parsed) ? parsed : 0
}

function rowCompletenessScore(row) {
    const values = Object.values(row || {})
    const filled = values.filter(value =>
        normalizeCsvText(value) !== ""
    ).length

    const hasStatus = normalizeCsvText(row?.Status) !== ""
    const hasContract = normalizeCsvText(row?.["Contrato Gerado"] || row?.Contrato) !== ""
    const hasValue = parseCurrencyLike(row?.["Valor contrato"] || row?.["Valor do contrato"]) > 0

    return filled * 2 + (hasStatus ? 3 : 0) + (hasContract ? 4 : 0) + (hasValue ? 2 : 0)
}

function getValuePrioritySortKeys(key, value) {
    const text = normalizeCsvText(value)
    if (!text) return [0, ""]

    const allowedStatusOrder = ["vencemos", "perdemos", "sem viabilidade", "em andamento", "novo", "negociando", "apresentando", "sondagem"]
    const lower = text.toLowerCase()

    if (key === "Status") {
        const statusIndex = allowedStatusOrder.indexOf(lower)
        return [statusIndex >= 0 ? 1 : 0, String(statusIndex >= 0 ? statusIndex : 999)]
    }

    if (/valor|taxa|preco|valor contrato|valor do contrato/i.test(key)) {
        return [parseCurrencyLike(value) > 0 ? 1 : 0, String(parseCurrencyLike(value))]
    }

    if (key === "Contrato Gerado" || key === "Contrato") {
        return [text && text !== "-" && text !== "não" && text !== "nao" ? 1 : 0, text]
    }

    return [text ? 1 : 0, text]
}

function mergeFieldValue(currentValue, incomingValue, key) {
    const currentText = normalizeCsvText(currentValue)
    const incomingText = normalizeCsvText(incomingValue)

    if (!currentText) return incomingText
    if (!incomingText) return currentText

    const currentNumeric = parseCurrencyLike(currentValue)
    const incomingNumeric = parseCurrencyLike(incomingValue)

    if (key.toLowerCase().includes("valor") || key.toLowerCase().includes("taxa") || key.toLowerCase().includes("preco")) {
        return incomingNumeric > currentNumeric ? incomingText : currentText
    }

    if (key === "Status" || key.toLowerCase().includes("status")) {
        const statusPriority = ["vencemos", "perdemos", "sem viabilidade", "novo", "negociando", "apresentando", "sondagem", ""]
        const currentIndex = statusPriority.indexOf(currentText.toLowerCase())
        const incomingIndex = statusPriority.indexOf(incomingText.toLowerCase())
        if (incomingIndex > currentIndex) return incomingText
        return currentText
    }

    if (currentText.length < incomingText.length) return incomingText
    return currentText
}

function mergeRowData(existingRow, incomingRow) {
    const merged = { ...(existingRow || {}) }
    const keys = new Set([
        ...Object.keys(existingRow || {}),
        ...Object.keys(incomingRow || {})
    ])

    keys.forEach(key => {
        const existingValue = existingRow?.[key]
        const incomingValue = incomingRow?.[key]
        const currentText = normalizeCsvText(existingValue)
        const incomingText = normalizeCsvText(incomingValue)

        if (!currentText && !incomingText) {
            merged[key] = ""
            return
        }

        if (!currentText) {
            merged[key] = incomingValue
            return
        }

        if (!incomingText) {
            merged[key] = existingValue
            return
        }

        merged[key] = mergeFieldValue(existingValue, incomingValue, key)
    })

    return merged
}

function getRowIdentity(row) {
    const identityCandidates = [
        row?.ID,
        row?.["ID Prospect"],
        row?.["ID do prospect"],
        row?.["Contrato Gerado"],
        row?.Contrato,
        row?.["Telefone celular"],
        row?.Telefone,
        row?.Celular,
        row?.["Razão"],
        row?.Razao,
        row?.["Nome do cliente"],
        row?.Cliente
    ]

    const normalized = identityCandidates
        .map(value => normalizeCsvText(value))
        .filter(Boolean)
        .map(value => value.toLowerCase())

    if (!normalized.length) return "__row_without_identity__"

    const priority = normalized.find(value => value && /^[0-9]+$/.test(value.replace(/[^0-9]/g, "")))
    if (priority) return `id:${priority}`

    return `razao:${normalized[0]}`
}

function choosePreferredRow(existingRow, incomingRow) {
    if (!existingRow) return incomingRow
    if (!incomingRow) return existingRow

    const currentScore = rowCompletenessScore(existingRow)
    const incomingScore = rowCompletenessScore(incomingRow)

    if (incomingScore > currentScore) return mergeRowData(existingRow, incomingRow)
    if (incomingScore < currentScore) return mergeRowData(existingRow, incomingRow)

    const currentStatus = normalizeCsvText(existingRow?.Status).toLowerCase()
    const incomingStatus = normalizeCsvText(incomingRow?.Status).toLowerCase()

    if (incomingStatus === "vencemos" && currentStatus !== "vencemos") return mergeRowData(existingRow, incomingRow)
    if (incomingStatus && !currentStatus) return mergeRowData(existingRow, incomingRow)

    return mergeRowData(existingRow, incomingRow)
}

function inferSheetRole(row) {
    const statusText = normalizeCsvText(row?.Status)
    const contractText = normalizeCsvText(row?.["Contrato Gerado"] || row?.Contrato)
    const valueText = normalizeCsvText(row?.["Valor contrato"] || row?.["Valor do plano"] || row?.Valor)
    const activationText = normalizeCsvText(row?.["Data ativação"] || row?.["Data de ativação"] || row?.["Data ativacao"])

    if (contractText || valueText || activationText) return "contract"
    if (statusText) return "prospect"
    return "unknown"
}

function mergeCsvRows(rows) {
    const mergedMap = new Map()
    const duplicateGroups = new Map()
    const duplicateCount = { total: 0 }
    const byRole = { prospect: 0, contract: 0, unknown: 0 }

    rows.forEach(row => {
        const identity = getRowIdentity(row)
        const role = inferSheetRole(row)
        byRole[role] = (byRole[role] || 0) + 1

        if (identity === "__row_without_identity__") {
            const fallbackKey = `__fallback__${mergedMap.size}`
            const existing = mergedMap.get(fallbackKey)
            const merged = choosePreferredRow(existing, row)
            mergedMap.set(fallbackKey, merged)
            return
        }

        const existing = mergedMap.get(identity)

        if (existing) {
            duplicateCount.total += 1
            const merged = choosePreferredRow(existing, row)
            duplicateGroups.set(identity, (duplicateGroups.get(identity) || 0) + 1)
            mergedMap.set(identity, merged)
            return
        }

        mergedMap.set(identity, row)
    })

    window.csvMergeAudit = {
        rawRows: rows.length,
        mergedRows: mergedMap.size,
        duplicatesMerged: duplicateCount.total,
        duplicateGroups: Object.fromEntries(Array.from(duplicateGroups.entries())),
        detectedByRole: byRole
    }

    console.log("window.csvMergeAudit", window.csvMergeAudit)

    return Array.from(mergedMap.values())
}

function findMatchingHeader(row, candidates) {
    const keys = Object.keys(row || {})
    const normalizedCandidates = candidates
        .filter(Boolean)
        .map(value => String(value).trim())

    for (const candidate of normalizedCandidates) {
        const exact = keys.find(key => normalizeCsvText(key) === normalizeCsvText(candidate))
        if (exact) return exact
    }

    for (const candidate of normalizedCandidates) {
        const loose = keys.find(key => normalizeCsvText(key).toLowerCase() === normalizeCsvText(candidate).toLowerCase())
        if (loose) return loose
    }

    for (const candidate of normalizedCandidates) {
        const partial = keys.find(key => normalizeCsvText(key).toLowerCase().includes(normalizeCsvText(candidate).toLowerCase()))
        if (partial) return partial
    }

    return null
}

function normalizeRowHeaders(row = {}) {
    const normalized = { ...row }

    const fieldMap = [
        [COLUMN_MAP.canal, ["Canal de venda", "Canal", "Canal de venda "]],
        [COLUMN_MAP.campanha, ["Campanha de venda", "Campanha", "Campanha de venda "]],
        [COLUMN_MAP.vendedor, ["Vendedor", "Vendedor Prospect", "Vendedor prospect", "Vendedor do prospect", "Vendedor Comercia", "Vendedor comercial", "Vendedor Contrato", "Vendedor do contrato", "Consultor"]],
        [COLUMN_MAP.status, ["Status", "status"]],
        [COLUMN_MAP.motivoPerda, ["Motivo perdemos", "Motivo", "Motivo de perda", "Descrição", "Descricao"]],
        [COLUMN_MAP.plano, ["Plano de venda", "Plano", "Plano do plano", "Plano de contrato"]],
        [COLUMN_MAP.data, ["Data do cadastro", "Data cadastro", "Data do Cadastro", "Data de cadastro"]],
        [COLUMN_MAP.dataAtivacao, ["Data ativação", "Data de ativação", "Data ativacao", "Data de ativacao", "Data Ativação", "Data Ativacao"]],
        [COLUMN_MAP.contrato, ["Contrato Gerado", "Contrato", "Contrato gerado"]],
        [COLUMN_MAP.valorContrato, ["Valor contrato", "Valor do plano", "Valor do contrato", "Valor"]],
        [COLUMN_MAP.taxaAtivacao, ["Taxa de ativação", "Taxa de ativacao", "Taxa de ativacao ", "Taxa ativação"]]
    ]

    fieldMap.forEach(([targetKey, aliases]) => {
        const match = findMatchingHeader(normalized, aliases)
        if (!match) return
        normalized[targetKey] = normalized[match]
    })

    return normalized
}

function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                const rows = results.data
                    .filter(item =>
                        Object.values(item)
                            .some(value => String(value || "").trim() !== "")
                    )
                    .map(normalizeRowHeaders)
                resolve(rows)
            },
            error: function (error) {
                reject(error)
            }
        })
    })
}

async function handleFile(event) {
    const newlySelectedFiles = Array.from(event.target.files || [])

    if (!newlySelectedFiles.length) return

    const uniqueFiles = Array.from(
        new Map(
            [...uploadedCsvFiles, ...newlySelectedFiles]
                .map(file => [`${file.name}|${file.size}|${file.lastModified}`, file])
        ).values()
    )

    uploadedCsvFiles = uniqueFiles
    event.target.value = ""

    try {
        const parsedFiles = await Promise.all(uploadedCsvFiles.map(parseCsvFile))
        const mergedRows = mergeCsvRows(parsedFiles.flat())
        rawData = mergedRows.map(applyBusinessRules)

        populateFilters(rawData)
        showDashboard()
        applyFilters()
    } catch (error) {
        console.error("Erro ao processar CSVs:", error)
    }
}

function showDashboard() {
    const emptyState =
        document.getElementById("emptyState")

    const dashboardContent =
        document.getElementById("dashboardContent")

    if (emptyState) {
        emptyState.classList.add("hidden")
    }

    if (dashboardContent) {
        dashboardContent.classList.remove("hidden")
    }
}
