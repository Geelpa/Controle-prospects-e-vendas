let sellersChart
let installationChart
let rawData = []
let currentFilteredData = []
const COLUMN_MAP = {
    canal: "Canal de venda",
    campanha: "Campanha",
    vendedor: "Vendedor",
    plano: "Plano de venda",
    status: "Status",
    motivoPerda: "Descrição",
    data: "Data do cadastro",
    contrato: "Status contrato",
    telefone: "Telefone"
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