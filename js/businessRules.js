/* ==========================================================================
   businessRules.js - CENTRAL DE REGRAS DE NEGÓCIO E AUDITORIA (CORRIGIDO)
   ========================================================================== */

// 1. Trata e converte valores numéricos vindos da planilha
const parseNumber = (value) => {
    return parseFlexibleNumber(value)
};

// 2. Identifica se é um plano adicional ou um prospect novo
const isAdditionalPlan = (item, map = COLUMN_MAP) => {
    if (!item || !map) return false;

    // Criamos uma mini função local de normalizar para garantir que nunca quebre por escopo
    const localNormalize = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const plano = localNormalize(item[map.plano]);
    const campanha = localNormalize(item[map.campanha]);
    const canal = localNormalize(item[map.canal]);
    const invalidTerms = ["adicional"];

    return invalidTerms.some(term =>
        plano.includes(term) || campanha.includes(term) || canal.includes(term)
    );
};

const isNewProspect = (item, map = COLUMN_MAP) =>
    !isAdditionalPlan(item, map);

function getProspectStatusCategory(item) {
    const status = normalize(item?.[COLUMN_MAP.status])
    if (STATUS.won.includes(status)) return "won"
    if (STATUS.lost.includes(status)) return "lost"
    if (STATUS.aborted.includes(status)) return "aborted"
    if (STATUS.noViability.includes(status)) return "noViability"
    if (STATUS.inProgress.includes(status)) return "inProgress"
    return "other"
}

function isNoStartProspect(item) {
    const description = normalize(item?.[COLUMN_MAP.descricao])
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[–—−]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/\s*-\s*/g, " - ")

    return description === "perdemos - nao iniciou"
}

function isGeneralLossProspect(item) {
    const category = getProspectStatusCategory(item)
    return ["lost", "aborted", "noViability"].includes(category) ||
        isNoStartProspect(item)
}

function isValidProspect(item) {
    return getProspectStatusCategory(item) !== "noViability" &&
        !isNoStartProspect(item)
}

// Uma venda é real quando o contrato está em um status válido e possui valor.
const isRealWonSale = (item, COLUMN_MAP) => {
    const contractCategory = getContractStatusCategory(item)
    if (contractCategory === "cancelled" || contractCategory === "withdrawn") return false
    const contractStatus = normalize(String(item?.[COLUMN_MAP.statusContrato] || ""));
    const hasActiveContract = STATUS.contractActive.includes(contractStatus);

    const price = parseNumber(item[COLUMN_MAP.valorContrato]);
    const hasPrice = price > 0;

    return hasActiveContract && hasPrice;
};