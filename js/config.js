let sellersChart
let installationChart
let rawData = []
let currentFilteredData = []

const COLUMN_MAP = {
    id: "ID",
    razao: "Razão",
    canal: "Canal de venda",
    campanha: "Campanha de venda",
    vendedor: "Vendedor",
    status: "Status",
    motivoPerda: "Motivo perdemos",
    plano: "Plano de venda",
    data: "Data do Cadastro",
    contrato: "Contrato Gerado",
    telefone: "Telefone celular",
    valorContrato: "Valor do plano",
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
        "novo",
        "negociando",
        "apresentando",
        "sondagem",
        "sem status"
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
