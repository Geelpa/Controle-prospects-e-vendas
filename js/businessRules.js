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
const isNewProspect = (item, COLUMN_MAP) => {
    // Criamos uma mini função local de normalizar para garantir que nunca quebre por escopo
    const localNormalize = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const plano = localNormalize(item[COLUMN_MAP.plano]);
    const campanha = localNormalize(item[COLUMN_MAP.campanha]);
    const canal = localNormalize(item[COLUMN_MAP.canal]);
    const invalidTerms = ["adicional"];

    return !invalidTerms.some(term =>
        plano.includes(term) || campanha.includes(term) || canal.includes(term)
    );
};

// 3. REGRA DE OURO CORRIGIDA: 
// Uma venda é real se tiver ALGO na coluna contrato (que não seja vazio, traço ou "não") E valor maior que zero.
const isRealWonSale = (item, COLUMN_MAP) => {
    const contractField = item[COLUMN_MAP.contrato];
    const contractClean = String(contractField || "").trim().toLowerCase();

    // Considera que tem contrato se o campo não estiver vazio, não for só um traço ou a palavra "não"
    const hasContract = contractClean !== "" &&
        contractClean !== "-" &&
        contractClean !== "nao" &&
        contractClean !== "não" &&
        contractClean !== "null" &&
        contractClean !== "undefined";

    const price = parseNumber(item[COLUMN_MAP.valorContrato]);

    // Se tiver preenchimento de contrato E o preço for maior que zero, é Venda Ganha!
    return hasContract && price > 0;
};