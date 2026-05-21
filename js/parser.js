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

            console.log("CSV BRUTO:", results.data)

            rawData = results.data.filter(item => {

                return Object.values(item)
                    .some(value =>
                        String(value || "").trim() !== ""
                    )
            })

            console.log(
                "COLUNAS:",
                Object.keys(rawData[0])
            )

            populateFilters(rawData)

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