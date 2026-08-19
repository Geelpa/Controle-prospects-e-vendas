let sellersChart
let installationChart
let rawData = []
let currentFilteredData = []
let currentProspectFilteredData = []

const COLUMN_MAP = {
    id: "ID",
    razao: "Razão",
    canal: "Canal de venda",
    canalOrigem: "Canal de origem",
    campanha: "Campanha de venda",
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
    taxaAtivacao: "Taxa de ativação"
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
    ]
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
