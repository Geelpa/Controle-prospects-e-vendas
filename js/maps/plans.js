// Map for explicit plan name mappings (optional direct matches)
// Keys should be the raw or lowercase versions typically found in the data
const PLAN_MAP = {
    // examples (kept for maintainability):
    "300mb em dobro": "Plus - 600Mb",
    "400mb em dobro": "Power - 800Mb",
    "plano adicional 200mb em dobro vpu - pf": "Adicional Start - 500Mb",
    // PME explicit examples
    "400mb + telefonia + 1 ip fixo pme - empresarial (lucro real)": "400Mb - PME",
    "1gb + telefonia + 1 ip fixo pme - empresarial (lucro real)": "1Gb + mesh - PME",
    "200mb pme - empresarial": "200Mb - PME"
};
