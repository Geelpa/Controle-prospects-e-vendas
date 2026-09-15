let uploadedCsvFiles = []
const SHORTCUT_STORAGE_KEY = "dashboardComercial.shortcuts"
let editingShortcutId = ""

document
    .getElementById("csvFile")
    .addEventListener("change", handleFile)

document
    .getElementById("savedShortcutSelect")
    .addEventListener("change", event => {
        updateShortcutActions(event.target.value)
        loadShortcut(event.target.value)
    })

document
    .getElementById("editShortcutButton")
    .addEventListener("click", () => openShortcutModal("edit"))

document
    .getElementById("deleteShortcutButton")
    .addEventListener("click", deleteSelectedShortcut)

document
    .getElementById("createShortcutButton")
    .addEventListener("click", openShortcutModal)

document
    .getElementById("closeShortcutModal")
    .addEventListener("click", closeShortcutModal)

document
    .getElementById("cancelShortcutButton")
    .addEventListener("click", closeShortcutModal)

document
    .getElementById("shortcutForm")
    .addEventListener("submit", saveShortcut)

document
    .getElementById("shortcutModal")
    .addEventListener("click", event => {
        if (event.target.id === "shortcutModal") closeShortcutModal()
    })

refreshShortcutSelect()

function normalizeCsvText(value) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
}

function parseCurrencyLike(value) {
    return parseFlexibleNumber(value)
}

function rowCompletenessScore(row) {
    const values = Object.values(row || {})
    const filled = values.filter(value =>
        normalizeCsvText(value) !== ""
    ).length

    const hasStatus = normalizeCsvText(row?.Status) !== ""
    const hasContract = normalizeCsvText(row?.["Status contrato"]) !== ""
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
        row?.[COLUMN_MAP.idContrato],
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

function normalizeContractKey(value) {
    const text = normalizeCsvText(value).toLowerCase()
    if (!text) return ""

    return text.replace(/\s+/g, "").replace(/\.0+$/, "")
}

function getContractKeys(row) {
    return Array.from(new Set([
        row?.[COLUMN_MAP.idContrato],
        row?.[COLUMN_MAP.contrato],
        row?.Contrato,
        row?.ID
    ].map(normalizeContractKey).filter(Boolean)))
}

function isReceivedPaymentRow(row) {
    return Boolean(
        normalizeCsvText(row?.[COLUMN_MAP.idContrato]) &&
        normalizeCsvText(row?.[COLUMN_MAP.valorRecebido])
    )
}

function buildReceivedByContract(rows) {
    const receivedByContract = new Map()

    rows.filter(isReceivedPaymentRow).forEach(row => {
        const amount = parseCurrencyLike(row[COLUMN_MAP.valorRecebido])
        if (!amount) return

        const contractKey = normalizeContractKey(row?.[COLUMN_MAP.idContrato]) || getContractKeys(row)[0]
        if (!contractKey) return

        receivedByContract.set(contractKey, (receivedByContract.get(contractKey) || 0) + amount)
    })

    return receivedByContract
}

function buildContractDetailsByContract(rows) {
    const detailsByContract = new Map()

    rows.filter(isReceivedPaymentRow).forEach(row => {
        const contractKey = normalizeContractKey(row?.[COLUMN_MAP.idContrato]) || getContractKeys(row)[0]
        if (!contractKey) return

        const existing = detailsByContract.get(contractKey)
        detailsByContract.set(contractKey, existing ? mergeRowData(existing, row) : { ...row })
    })

    return detailsByContract
}

function attachContractData(rows, contractDetailsByContract) {
    const matchedContracts = new Set()
    const enrichedRows = rows.map(row => {
        const contractKey = getContractKeys(row)
            .map(key => contractDetailsByContract.has(key) ? key : "")
            .find(Boolean)

        if (!contractKey) return row

        matchedContracts.add(contractKey)
        return mergeRowData(row, contractDetailsByContract.get(contractKey))
    })

    contractDetailsByContract.forEach((detail, contractKey) => {
        if (!matchedContracts.has(contractKey)) enrichedRows.push(detail)
    })

    return enrichedRows
}

function attachReceivedValues(rows, receivedByContract) {
    return rows.map(row => {
        const received = getContractKeys(row)
            .map(key => receivedByContract.get(key) || 0)
            .find(value => value > 0) || 0

        return {
            ...row,
            [COLUMN_MAP.valorRecebido]: received
        }
    })
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
    const contractStatusText = normalizeCsvText(row?.["Status contrato"])
    const contractText = normalizeCsvText(row?.["Contrato Gerado"] || row?.Contrato)
    const valueText = normalizeCsvText(row?.["Valor contrato"] || row?.["Valor do plano"] || row?.Valor)
    const activationText = normalizeCsvText(row?.["Data ativação"] || row?.["Data de ativação"] || row?.["Data ativacao"])

    if (contractText || valueText || activationText || contractStatusText) return "contract"
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

    if (window.DASHBOARD_DEBUG === true) {
        console.log("window.csvMergeAudit", window.csvMergeAudit)
    }

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
        [COLUMN_MAP.razao, ["Razão", "Razao", "Razão social", "Razao social", "Razão social/nome", "Razao social/nome"]],
        [COLUMN_MAP.statusContrato, ["Status contrato", "Status do contrato", "Status Contrato"]],
        [COLUMN_MAP.latitudeProspect, ["Latitude Prospect", "Latitude do prospect"]],
        [COLUMN_MAP.longitudeProspect, ["Longitude Prospect", "Longitude do prospect"]],
        [COLUMN_MAP.latitude, ["Latitude"]],
        [COLUMN_MAP.longitude, ["Longitude"]],
        [COLUMN_MAP.cep, ["CEP", "Cep"]],
        [COLUMN_MAP.canal, ["Canal de venda", "Canal", "Canal de venda "]],
        [COLUMN_MAP.campanha, ["Campanha de venda", "Campanha", "Campanha de venda "]],
        [COLUMN_MAP.campanhaInstalacao, ["Campanha de instalação", "Campanha de instalacao"]],
        [COLUMN_MAP.vendedorProspect, ["Vendedor Prospect", "Vendedor prospect", "Vendedor do prospect"]],
        [COLUMN_MAP.vendedorContrato, ["Vendedor Contrato", "Vendedor do contrato", "Vendedor contrato"]],
        [COLUMN_MAP.vendedor, ["Vendedor", "Vendedor Comercia", "Vendedor comercial", "Consultor"]],
        [COLUMN_MAP.prospeccao, ["Prospecção", "Prospeccao", "Prospecção?", "É prospecção", "E prospeccao"]],
        [COLUMN_MAP.status, ["Status", "status"]],
        [COLUMN_MAP.motivoPerda, ["Motivo perdemos", "Motivo", "Motivo de perda", "Descrição", "Descricao"]],
        [COLUMN_MAP.plano, ["Plano de venda", "Plano", "Plano do plano", "Plano de contrato"]],
        [COLUMN_MAP.data, ["Data do cadastro", "Data cadastro", "Data do Cadastro", "Data de cadastro"]],
        [COLUMN_MAP.dataAtivacao, ["Data ativação", "Data de ativação", "Data ativacao", "Data de ativacao", "Data Ativação", "Data Ativacao"]],
        [COLUMN_MAP.contrato, ["Contrato Gerado", "Contrato", "Contrato gerado"]],
        [COLUMN_MAP.idContrato, ["ID contrato", "ID Contrato", "Id contrato", "Contrato ID"]],
        [COLUMN_MAP.valorContrato, ["Valor contrato", "Valor do plano", "Valor do contrato", "Valor"]],
        [COLUMN_MAP.valorRecebido, ["Valor recebido", "Valor Recebido", "Valor recebido total", "Recebido"]],
        [COLUMN_MAP.taxaAtivacao, ["Taxa de ativação", "Taxa de ativacao", "Taxa de ativacao ", "Taxa ativação"]],
        [COLUMN_MAP.descricaoCancelamento, ["Descrição do cancelamento", "Descricao do cancelamento"]],
        [COLUMN_MAP.dataCancelamento, ["Data do cancelamento", "Data do cancelamento "]],
        [COLUMN_MAP.descricaoDesistencia, ["Descrição da desistência", "Descricao da desistência", "Descrição da desistencia", "Descricao da desistencia"]],
        [COLUMN_MAP.dataDesistencia, ["Data da desistência", "Data da desistencia"]]
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
                resolve(rows.map(applyLeoProspectSeller))
            },
            error: function (error) {
                reject(error)
            }
        })
    })
}

function applyLeoProspectSeller(row) {
    const prospectFlag = normalizeCsvText(row?.[COLUMN_MAP.prospeccao]).toLowerCase()
    const isProspectWithoutSeller =
        prospectFlag === "não" || prospectFlag === "nao"
    const isOwnershipTransfer = [
        row?.[COLUMN_MAP.canal],
        row?.[COLUMN_MAP.canalOrigem],
        row?.[COLUMN_MAP.campanha]
    ].some(value => normalizeCsvText(value).toLowerCase() === "troca de titularidade")

    if (!isProspectWithoutSeller || isOwnershipTransfer) return row

    const sellerValues = [
        row?.[COLUMN_MAP.vendedorProspect],
        row?.[COLUMN_MAP.vendedor]
    ]
    const hasSeller = sellerValues.some(value => {
        const text = normalizeCsvText(value).toLowerCase()
        return text && text !== "-" && text !== "--" && text !== "undefined" && text !== "null"
    })

    if (hasSeller) return row

    return {
        ...row,
        [COLUMN_MAP.vendedorProspect]: "Léo",
        [COLUMN_MAP.vendedor]: "Léo"
    }
}

function getSavedShortcuts() {
    try {
        const shortcuts = JSON.parse(localStorage.getItem(SHORTCUT_STORAGE_KEY) || "[]")
        return Array.isArray(shortcuts) ? shortcuts : []
    } catch (error) {
        console.warn("Não foi possível ler os atalhos salvos:", error)
        return []
    }
}

function setSavedShortcuts(shortcuts) {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcuts))
}

function refreshShortcutSelect() {
    const select = document.getElementById("savedShortcutSelect")
    if (!select) return

    select.innerHTML = "<option value=\"\">Atalhos salvos</option>"
    getSavedShortcuts().forEach(shortcut => {
        const option = document.createElement("option")
        option.value = shortcut.id
        option.textContent = shortcut.name
        select.appendChild(option)
    })

    updateShortcutActions(select.value)
}

function updateShortcutActions(shortcutId) {
    const hasSelection = Boolean(shortcutId)
    const editButton = document.getElementById("editShortcutButton")
    const deleteButton = document.getElementById("deleteShortcutButton")

    if (editButton) editButton.disabled = !hasSelection
    if (deleteButton) deleteButton.disabled = !hasSelection
}

function openShortcutModal(mode = "create") {
    const modal = document.getElementById("shortcutModal")
    const message = document.getElementById("shortcutFormMessage")
    if (!modal) return

    const select = document.getElementById("savedShortcutSelect")
    const shortcut = mode === "edit"
        ? getSavedShortcuts().find(item => item.id === select?.value)
        : null

    if (mode === "edit" && !shortcut) return

    editingShortcutId = shortcut?.id || ""
    document.getElementById("shortcutForm")?.reset()
    document.getElementById("shortcutName").value = shortcut?.name || ""
    document.getElementById("shortcutModalTitle").textContent = shortcut ? "Editar atalho" : "Criar atalho"
    document.getElementById("shortcutModalDescription").textContent = shortcut
        ? "Atualize o nome ou substitua os arquivos salvos."
        : "Salve um conjunto de arquivos para consultar depois."
    document.getElementById("shortcutFilesHint").textContent = shortcut
        ? `${shortcut.files.length} arquivo(s) salvo(s). Selecione novos arquivos para substituir.`
        : "Selecione um ou mais arquivos."
    document.getElementById("saveShortcutButton").textContent = shortcut ? "Salvar alterações" : "Salvar atalho"
    message?.classList.add("hidden")
    modal.classList.remove("hidden")
}

function closeShortcutModal() {
    editingShortcutId = ""
    document.getElementById("shortcutModal")?.classList.add("hidden")
}

function showShortcutMessage(message, isError = false) {
    const element = document.getElementById("shortcutFormMessage")
    if (!element) return

    element.textContent = message
    element.classList.toggle("hidden", !message)
    element.classList.toggle("text-red-300", isError)
    element.classList.toggle("text-green-300", !isError)
}

async function saveShortcut(event) {
    event.preventDefault()

    const name = document.getElementById("shortcutName").value.trim()
    const files = Array.from(document.getElementById("shortcutFiles").files || [])

    const existingShortcut = editingShortcutId
        ? getSavedShortcuts().find(shortcut => shortcut.id === editingShortcutId)
        : null

    if (!name || (!files.length && !existingShortcut)) return

    const duplicateName = getSavedShortcuts().some(shortcut =>
        shortcut.id !== editingShortcutId && shortcut.name.toLowerCase() === name.toLowerCase()
    )
    if (duplicateName) {
        showShortcutMessage("Já existe um atalho com esse nome.", true)
        return
    }

    const shortcutFiles = files.length
        ? await Promise.all(files.map(async file => ({
            name: file.name,
            type: file.type || "text/csv",
            lastModified: file.lastModified,
            content: await file.text()
        })))
        : existingShortcut.files

    const shortcut = {
        id: existingShortcut?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        files: shortcutFiles
    }

    try {
        const shortcuts = getSavedShortcuts()
        const updatedShortcuts = existingShortcut
            ? shortcuts.map(item => item.id === existingShortcut.id ? shortcut : item)
            : [...shortcuts, shortcut]
        setSavedShortcuts(updatedShortcuts)
    } catch (error) {
        showShortcutMessage("Não foi possível salvar. O armazenamento do navegador pode estar cheio.", true)
        return
    }

    refreshShortcutSelect()
    document.getElementById("savedShortcutSelect").value = shortcut.id
    updateShortcutActions(shortcut.id)
    closeShortcutModal()
}

function deleteSelectedShortcut() {
    const select = document.getElementById("savedShortcutSelect")
    const shortcutId = select?.value
    const shortcut = getSavedShortcuts().find(item => item.id === shortcutId)
    if (!shortcut) return

    if (!window.confirm(`Excluir o atalho "${shortcut.name}"?`)) return

    setSavedShortcuts(getSavedShortcuts().filter(item => item.id !== shortcutId))
    refreshShortcutSelect()
    select.value = ""
    updateShortcutActions("")
    editingShortcutId = ""
}

async function loadShortcut(shortcutId) {
    const select = document.getElementById("savedShortcutSelect")
    if (!shortcutId) return

    const shortcut = getSavedShortcuts().find(item => item.id === shortcutId)
    if (!shortcut) {
        refreshShortcutSelect()
        return
    }

    const files = shortcut.files.map(file => new File(
        [file.content],
        file.name,
        { type: file.type || "text/csv", lastModified: file.lastModified }
    ))

    try {
        await processCsvFiles(files, true)
    } catch (error) {
        console.error("Erro ao carregar atalho:", error)
    } finally {
        if (select) {
            select.value = shortcutId
            updateShortcutActions(shortcutId)
        }
    }
}

async function processCsvFiles(newlySelectedFiles, replaceUploadedFiles = false) {
    const baseFiles = replaceUploadedFiles ? [] : uploadedCsvFiles

    if (!newlySelectedFiles.length) return

    const uniqueFiles = Array.from(
        new Map(
            [...baseFiles, ...newlySelectedFiles]
                .map(file => [`${file.name}|${file.size}|${file.lastModified}`, file])
        ).values()
    )

    uploadedCsvFiles = uniqueFiles

    const parsedFiles = await Promise.all(uploadedCsvFiles.map(parseCsvFile))
    const parsedRows = parsedFiles.flat()
    const receivedByContract = buildReceivedByContract(parsedRows)
    const contractDetailsByContract = buildContractDetailsByContract(parsedRows)
    const operationalRows = parsedRows.filter(row => !isReceivedPaymentRow(row))
    const mergedRows = mergeCsvRows(operationalRows)
    const enrichedRows = attachContractData(mergedRows, contractDetailsByContract)
    rawData = attachReceivedValues(enrichedRows, receivedByContract).map(applyBusinessRules)
    window.receivedByContract = Object.fromEntries(receivedByContract.entries())

    populateFilters(rawData)
    showDashboard()
    applyFilters()
}

async function handleFile(event) {
    const newlySelectedFiles = Array.from(event.target.files || [])
    event.target.value = ""

    if (!newlySelectedFiles.length) return

    try {
        await processCsvFiles(newlySelectedFiles)
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
