document
    .getElementById("csvFile")
    .addEventListener("change", handleFile)

function handleFile(event) {

    const file = event.target.files[0]

    if (!file) return

    Papa.parse(file, {

        header: true,

        skipEmptyLines: true,

        complete: function (results) {
            rawData = results.data.filter(item => {

                return Object.values(item)
                    .some(value =>
                        String(value || "").trim() !== ""
                    )
            })

            populateFilters(rawData)

            showDashboard()

            applyFilters()
        },

        error: function (error) {

            console.error(
                "Erro PapaParse:",
                error
            )
        }
    })
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
