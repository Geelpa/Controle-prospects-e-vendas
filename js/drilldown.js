const DRILLDOWN_TITLES = {
    prospects: "Prospects",
    inProgress: "Prospects em andamento",
    won: "Prospects vencidos",
    lost: "Prospects perdidos",
    noViability: "Prospects sem viabilidade",
    installationPaid: "Vendas com taxa paga",
    installationFree: "Vendas com taxa isenta"
}

const LIST_COLUMN_CANDIDATES = [
    "ID",
    "Id",
    "id",
    "Código",
    "Codigo",
    "Cód.",
    "Cod.",
    "Razão",
    "Razao",
    "Razão social",
    "Razao social",
    "Razão Social",
    "Razao Social",
    "Nome",
    "Nome do prospect",
    "Cliente",
    "Empresa",
    "Telefone",
    "Celular",
    COLUMN_MAP.status,
    COLUMN_MAP.motivoPerda,
    COLUMN_MAP.vendedor,
    COLUMN_MAP.plano,
    COLUMN_MAP.canal,
    COLUMN_MAP.campanha,
    // COLUMN_MAP.data,
    // "Data do cadastro",
    // "Data de cadastro",
    // "Data cadastro",
    // "Data de ativação",
    // "Data de ativacao",
    // "Data ativação",
    // "Data ativacao",
    // "Ativação",
    // "Ativacao"
]

function openProspectList(type) {
    const rows = getRowsByDrilldownType(type)

    openProspectListForRows(
        DRILLDOWN_TITLES[type] || "Prospects",
        rows,
        {
            hiddenColumns: getHiddenColumnsByDrilldownType(type)
        }
    )
}

function openProspectListForRows(modalTitle, rows, options = {}) {
    const modal = document.getElementById("prospectModal")
    const title = document.getElementById("prospectModalTitle")
    const count = document.getElementById("prospectModalCount")

    if (!modal) return

    title.textContent =
        modalTitle || "Prospects"

    count.textContent =
        `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`

    renderProspectTable(rows, options)

    modal.classList.remove("hidden")
}

function getHiddenColumnsByDrilldownType(type) {
    const statusDrilldowns = [
        "inProgress",
        "won",
        "lost",
        "noViability"
    ]

    const hiddenColumns = []

    if (statusDrilldowns.includes(type)) {
        hiddenColumns.push(COLUMN_MAP.status)
    }

    if (type === "inProgress" || type === "noViability") {
        hiddenColumns.push(COLUMN_MAP.motivoPerda)
    }

    if (type === "installationPaid" || type === "installationFree") {
        hiddenColumns.push(COLUMN_MAP.status)
        hiddenColumns.push(COLUMN_MAP.motivoPerda)
    }

    return hiddenColumns
}

function closeProspectList() {
    const modal = document.getElementById("prospectModal")

    if (modal) {
        modal.classList.add("hidden")
    }
}

function getRowsByDrilldownType(type) {
    const rows = currentFilteredData || []

    if (type === "prospects") {
        return rows
    }

    if (type === "inProgress") {
        return rows.filter(item =>
            STATUS.inProgress.includes(
                normalize(item[COLUMN_MAP.status])
            )
        )
    }

    if (type === "won") {
        return rows.filter(isWon)
    }

    if (type === "lost") {
        return rows.filter(item =>
            STATUS.lost.includes(
                normalize(item[COLUMN_MAP.status])
            )
        )
    }

    if (type === "noViability") {
        return rows.filter(item =>
            STATUS.noViability.includes(
                normalize(item[COLUMN_MAP.status])
            )
        )
    }

    if (type === "installationPaid") {
        return rows.filter(item =>
            isWon(item) && !isFreeInstallation(item)
        )
    }

    if (type === "installationFree") {
        return rows.filter(item =>
            isWon(item) && isFreeInstallation(item)
        )
    }

    return []
}

function isWon(item) {
    return STATUS.won.includes(
        normalize(item[COLUMN_MAP.status])
    )
}

function isFreeInstallation(item) {
    const campaignId = item[COLUMN_MAP.campanha];
    const campaignName = CAMPAIGN_MAP[campaignId] || "";

    const normalizedCampaignName = normalize(campaignName);

    const palavrasFree = ["isenta", "troca", "negociação", "não preenchido"];

    return palavrasFree.some(palavra => normalizedCampaignName.includes(palavra));
}

function renderProspectTable(rows, options = {}) {
    const header = document.getElementById("prospectListHeader")
    const body = document.getElementById("prospectListBody")
    const empty = document.getElementById("prospectModalEmpty")

    if (!header || !body || !empty) return

    header.innerHTML = ""
    body.innerHTML = ""

    empty.classList.toggle("hidden", rows.length > 0)

    const hiddenColumns =
        options.hiddenColumns || []

    const columns = getListColumns(rows)
        .filter(column =>
            !hiddenColumns.some(hiddenColumn =>
                normalize(hiddenColumn) === normalize(column)
            )
        )

    columns.forEach(column => {
        const cell = document.createElement("th")

        cell.className = "p-4 text-left text-slate-800 whitespace-normal "
        cell.textContent = getColumnLabel(column)

        header.appendChild(cell)
    })

    rows.forEach(row => {
        const line = document.createElement("tr")

        line.className = "hover:bg-slate-50"

        columns.forEach(column => {
            const cell = document.createElement("td")

            cell.className = "p-2 text-slate-600 border border-slate-300"
            cell.textContent = formatListValue(column, row[column])

            line.appendChild(cell)
        })

        body.appendChild(line)
    })
}

function getListColumns(rows) {
    if (!rows.length) {
        return [
            COLUMN_MAP.status,
            COLUMN_MAP.vendedor,
            COLUMN_MAP.plano,
            COLUMN_MAP.canal,
            COLUMN_MAP.campanha,
            COLUMN_MAP.data
        ]
    }

    const availableColumns =
        Object.keys(rows[0])

    const selectedColumns =
        LIST_COLUMN_CANDIDATES
            .map(candidate =>
                availableColumns.find(column =>
                    normalize(column) === normalize(candidate)
                )
            )
            .filter(Boolean)
            .filter((column, index, columns) =>
                columns.indexOf(column) === index
            )

    return selectedColumns.length
        ? selectedColumns
        : availableColumns.slice(0, 8)
}

function getColumnLabel(column) {
    if (column === COLUMN_MAP.motivoPerda) {
        return "Motivo"
    }

    return column
}

function formatListValue(column, value) {
    if (column === COLUMN_MAP.vendedor) {
        return SELLER_MAP[value] || value || "-"
    }

    if (column === COLUMN_MAP.plano) {
        return PLAN_MAP[value]?.name || value || "-"
    }

    if (column === COLUMN_MAP.canal) {
        return CHANNEL_MAP[value] || value || "-"
    }

    if (column === COLUMN_MAP.campanha) {
        return CAMPAIGN_MAP[value] || value || "-"
    }

    return value || "-"
}

document
    .querySelectorAll("[data-drilldown]")
    .forEach(card => {
        card.addEventListener("click", () => {
            openProspectList(card.dataset.drilldown)
        })

        card.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return

            event.preventDefault()
            openProspectList(card.dataset.drilldown)
        })
    })

document
    .getElementById("closeProspectModal")
    .addEventListener("click", closeProspectList)

document
    .getElementById("prospectModal")
    .addEventListener("click", event => {
        if (event.target.id === "prospectModal") {
            closeProspectList()
        }
    })

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeProspectList()
    }
})
