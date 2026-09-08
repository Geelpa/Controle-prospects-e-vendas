let sellersChart
let installationChart
let rawData = []
let currentFilteredData = []
let currentProspectFilteredData = []

const COLUMN_MAP = {
    id: "ID",
    razao: "Razão",
    statusContrato: "Status contrato",
    latitudeProspect: "Latitude Prospect",
    longitudeProspect: "Longitude Prospect",
    latitude: "Latitude",
    longitude: "Longitude",
    cep: "CEP",
    canal: "Canal de venda",
    canalOrigem: "Canal de origem",
    campanha: "Campanha de venda",
    campanhaInstalacao: "Campanha de instalação",
    vendedor: "Vendedor",
    vendedorProspect: "Vendedor Prospect",
    vendedorContrato: "Vendedor Contrato",
    status: "Status",
    motivoPerda: "Motivo perdemos",
    plano: "Plano de venda",
    data: "Data do Cadastro",
    dataAtivacao: "Data ativação",
    contrato: "Contrato Gerado",
    telefone: "Telefone celular",
    valorContrato: "Valor contrato",
    taxaAtivacao: "Taxa de ativação",
    dataCancelamento: "Data do cancelamento",
    dataDesistencia: "Data da desistência",
    descricaoCancelamento: "Descrição do cancelamento",
    descricaoDesistencia: "Descrição da desistência"
}

const STATUS = {

    won: [
        "vencemos"
    ],

    lost: [
        "perdemos"
    ],

    noViability: [
        "sem viabilidade"
    ],

    inProgress: [
        "",
        "--",
        "novo",
        "negociando",
        "apresentando",
        "sondagem"
    ],
    contractPre: [
        "pré-contrato",
        "pre-contrato",
        "pré contrato",
        "pre contrato"
    ],
    contractInactive: [
        "inativo"
    ],
    contractWithdrawn: [
        "desistiu",
        "desistência",
        "desistencia"
    ],
    contractCancelled: [
        "cancelou",
        "cancelado",
        "cancelada"
    ]
}

function hasMeaningfulContractField(value) {
    const text = String(value ?? "").trim()
    return text !== "" && text !== "00/00/0000" && text !== "00/00/0000 00:00:00"
}

function getContractStatusCategory(item) {
    if (hasMeaningfulContractField(item?.[COLUMN_MAP.descricaoCancelamento]) ||
        hasMeaningfulContractField(item?.[COLUMN_MAP.dataCancelamento])) {
        return "cancelled"
    }

    if (hasMeaningfulContractField(item?.[COLUMN_MAP.descricaoDesistencia]) ||
        hasMeaningfulContractField(item?.[COLUMN_MAP.dataDesistencia])) {
        return "withdrawn"
    }

    const description = normalize(item?.[COLUMN_MAP.motivoPerda])
    if (description.includes("cancel")) return "cancelled"
    if (description.includes("desist")) return "withdrawn"

    const status = normalize(item?.[COLUMN_MAP.statusContrato])
    if (STATUS.contractPre.includes(status)) return "preContract"
    if (STATUS.contractInactive.includes(status)) return "inactive"
    return ""
}

function isInactiveContract(item) {
    return ["inactive", "withdrawn", "cancelled"].includes(
        getContractStatusCategory(item)
    )
}

const MONTH_MAP = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro"
}

let originalData = []
let plansChart
let channelsChart
let campaignsChart
let lossReasonsChart
let salesPerDayChart
