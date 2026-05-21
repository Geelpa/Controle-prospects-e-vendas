function handleFileUpload(event) {

    const file = event.target.files[0]

    if (!file) return

    Papa.parse(file, {

        header: true,
        skipEmptyLines: true,

        complete: function (results) {

            originalData = results.data

            populateFilters(originalData)

            applyFilters()
        }
    })
}