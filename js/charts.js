function createChannelsChart(data) {

    destroyChart(channelsChart)

    const grouped = groupBy(data, COLUMN_MAP.canal)

    channelsChart = new Chart(
        document.getElementById("channelsChart"),
        {
            type: "bar",

            data: {
                labels: Object.keys(grouped),

                datasets: [{
                    label: "Canais",
                    data: Object.values(grouped)
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "##000"
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },
                    y: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}

function createCampaignsChart(data) {

    destroyChart(campaignsChart)

    const grouped = groupBy(data, COLUMN_MAP.campanha)

    campaignsChart = new Chart(
        document.getElementById("campaignsChart"),
        {
            type: "bar",

            data: {
                labels: Object.keys(grouped),

                datasets: [{
                    label: "Campanhas",
                    data: Object.values(grouped)
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "##000"
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },
                    y: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}

function createLossReasonsChart(data) {

    destroyChart(lossReasonsChart)

    const lostOnly = data.filter(item =>
        STATUS.lost.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = groupBy(
        lostOnly,
        COLUMN_MAP.motivoPerda
    )

    lossReasonsChart = new Chart(
        document.getElementById("lossReasonsChart"),
        {
            type: "bar",

            data: {
                labels: Object.keys(grouped),

                datasets: [{
                    label: "Motivos",
                    data: Object.values(grouped)
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "##000"
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },
                    y: {
                        ticks: {
                            color: "##000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}

function createSalesPerDayChart(data) {

    destroyChart(salesPerDayChart)

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = {}

    wonOnly.forEach(item => {

        const originalDate =
            item[COLUMN_MAP.data]

        const parsedDate =
            parseDate(originalDate)

        // PADRONIZA yyyy-mm-dd
        const day =
            String(parsedDate.getDate())
                .padStart(2, "0")

        const month =
            String(parsedDate.getMonth() + 1)
                .padStart(2, "0")

        const year =
            parsedDate.getFullYear()

        const key =
            `${year}-${month}-${day}`

        grouped[key] =
            (grouped[key] || 0) + 1
    })

    // ORDENA DATAS
    const sortedEntries =
        Object.entries(grouped)
            .sort((a, b) =>
                new Date(a[0]) - new Date(b[0])
            )

    // FORMATA PARA BR
    const labels = sortedEntries.map(([date]) => {

        const d = new Date(date)

        return d.toLocaleDateString("pt-BR")
    })

    const values =
        sortedEntries.map(([_, value]) => value)

    salesPerDayChart = new Chart(
        document.getElementById("salesPerDayChart"),
        {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Vendas",
                    data: values,
                    tension: 0.3
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        labels: {
                            color: "#000"
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },

                    y: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}

function createSellersChart(data) {

    destroyChart(sellersChart)

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = groupBy(
        wonOnly,
        COLUMN_MAP.vendedor
    )

    sellersChart = new Chart(
        document.getElementById("sellersChart"),
        {
            type: "bar",

            data: {
                labels: Object.keys(grouped),

                datasets: [{
                    label: "Vendas",
                    data: Object.values(grouped)
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        labels: {
                            color: "#000"
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },

                    y: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}

function createInstallationChart(data) {

    destroyChart(installationChart)

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    let paid = 0
    let free = 0

    wonOnly.forEach(item => {

        const campaignId =
            item[COLUMN_MAP.campanha]

        const campaignName =
            CAMPAIGN_MAP[campaignId] || ""

        if (
            normalize(campaignName)
                .includes("isenta")
        ) {
            free++
        } else {
            paid++
        }
    })

    installationChart = new Chart(
        document.getElementById("installationChart"),
        {
            type: "doughnut",

            data: {
                labels: [
                    "Taxa Paga",
                    "Taxa Isenta"
                ],

                datasets: [{
                    data: [paid, free]
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        labels: {
                            color: "#000"
                        }
                    }
                }
            }
        }
    )
}

function createPlansChart(data) {

    destroyChart(plansChart)

    const wonOnly = data.filter(item =>
        STATUS.won.includes(
            normalize(item[COLUMN_MAP.status])
        )
    )

    const grouped = groupBy(
        wonOnly,
        COLUMN_MAP.plano
    )

    plansChart = new Chart(
        document.getElementById("plansChart"),
        {
            type: "bar",

            data: {
                labels: Object.keys(grouped),

                datasets: [{
                    label: "Planos",
                    data: Object.values(grouped)
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        labels: {
                            color: "#000"
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    },

                    y: {
                        ticks: {
                            color: "#000"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        }
                    }
                }
            }
        }
    )
}