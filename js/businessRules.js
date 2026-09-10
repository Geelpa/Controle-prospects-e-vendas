/* ==========================================================================
   businessRules.js - CENTRAL DE REGRAS DE NEGÓCIO E AUDITORIA (CORRIGIDO)
   ========================================================================== */

// 1. Trata e converte valores numéricos vindos da planilha
const parseNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return 0;
    if (typeof value === 'number') return value;

    let cleanValue = value.toString().replace(/[R$\s]/g, '').trim();

    if (cleanValue.includes(',') && cleanValue.includes('.')) {
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else {
        cleanValue = cleanValue.replace(',', '.');
    }

    if ((cleanValue.match(/\./g) || []).length > 1) {
        const parts = cleanValue.split('.');
        cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }

    const result = parseFloat(cleanValue);
    return isNaN(result) ? 0 : result;
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

// Uma venda é real quando o contrato está em um status válido e possui valor.
const isRealWonSale = (item, COLUMN_MAP) => {
    const contractCategory = getContractStatusCategory(item)
    if (contractCategory === "cancelled" || contractCategory === "withdrawn") return false
    const contractStatus = normalize(String(item?.[COLUMN_MAP.statusContrato] || ""));
    const hasContract = contractStatus !== "" &&
        !STATUS.contractPre.includes(contractStatus) &&
        !STATUS.contractInactive.includes(contractStatus) &&
        !STATUS.contractWithdrawn.includes(contractStatus) &&
        !STATUS.contractCancelled.includes(contractStatus);

    const price = parseNumber(item[COLUMN_MAP.valorContrato]);
    const hasPrice = price > 0;

    return (hasContract && hasPrice);
};