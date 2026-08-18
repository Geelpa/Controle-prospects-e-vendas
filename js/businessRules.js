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

// 2. Identifica se é um prospect novo ou movimentação de base
const isNewProspect = (item, map = COLUMN_MAP) => {
    if (!item || !map) return false;

    // Criamos uma mini função local de normalizar para garantir que nunca quebre por escopo
    const localNormalize = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const plano = localNormalize(item[map.plano]);
    const campanha = localNormalize(item[map.campanha]);
    const canal = localNormalize(item[map.canal]);
    const invalidTerms = ["adicional"];

    // Plano adicional não é prospect novo, mas isso não impede que gere venda/contrato.
    // Troca de titularidade continua sendo tratada como prospect, porque representa entrada de cliente novo.
    return !invalidTerms.some(term =>
        plano.includes(term) || campanha.includes(term) || canal.includes(term)
    );
};

// 3. REGRA DE OURO CORRIGIDA: 
// Uma venda é real se tiver ALGO na coluna contrato (que não seja vazio, traço ou "não") E valor maior que zero.
const isRealWonSale = (item, COLUMN_MAP) => {
    const statusText = normalize(String(item?.[COLUMN_MAP.status] || ""));
    const hasWonStatus = STATUS.won.includes(statusText);

    const contractField = item[COLUMN_MAP.contrato];
    const contractClean = String(contractField || "").trim().toLowerCase();

    const hasContract = contractClean !== "" &&
        contractClean !== "-" &&
        contractClean !== "nao" &&
        contractClean !== "não" &&
        contractClean !== "null" &&
        contractClean !== "undefined";

    const price = parseNumber(item[COLUMN_MAP.valorContrato]);
    const hasPrice = price > 0;

    // Regra correta do negócio: considera como venda confirmada qualquer item
    // que esteja como "vencemos" ou que tenha contrato ativo com valor.
    return hasWonStatus || (hasContract && hasPrice);
};