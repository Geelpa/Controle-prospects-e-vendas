import csv,sys,os,re
from collections import defaultdict

files = [
    r"c:\Users\Eduardo Augusto\Downloads\Comercial_- Relatório Vencemos - 2026-08-17T085924.357.csv",
    r"c:\Users\Eduardo Augusto\Downloads\Relatorio_Consolidado - 2026-08-17T085941.738.csv",
    r"c:\Users\Eduardo Augusto\Downloads\Comercial_- Status Prospects - Geral - 2026-08-17T085933.107.csv",
]

NORMALIZE = lambda s: (s or "").strip().lower()

def parse_number(v):
    if v is None: return 0.0
    s = str(v).strip()
    s = s.replace('R$','').replace('r$','').replace(' ','')
    s = s.replace('.','').replace(',','.')
    try:
        return float(s)
    except:
        return 0.0

bad_contract_vals = set(['','-','nao','não','null','undefined'])

for path in files:
    if not os.path.exists(path):
        print('MISSING:',path); continue
    print('\nFILE:',os.path.basename(path))
    # read as ; delimited, handle BOM
    with open(path,'r',encoding='utf-8',errors='replace') as f:
        reader = csv.DictReader(f, delimiter=';')
        rows = [r for r in reader]
    raw = [r for r in rows if any((str(v).strip()!='') for v in r.values())]
    rawCount = len(raw)
    # determine column names (case-insensitive match)
    keys = list((raw[0].keys())) if raw else []
    # helper to find column by possible names
    def find(*candidates):
        for cand in candidates:
            for k in keys:
                if k is None: continue
                if re.sub(r"\s+","",k.strip().lower()) == re.sub(r"\s+","",cand.strip().lower()):
                    return k
        return None
    col_id = find('ID','Id','id')
    col_status = find('Status','status')
    col_plano = find('Plano de venda','Plano','Plano de Venda')
    col_campanha = find('Campanha de venda','Campanha','Campanha de venda')
    col_canal = find('Canal de venda','Canal','Canal de venda')
    col_contrato = find('Contrato Gerado','Contrato','contrato')
    col_valor = find('Valor do plano','Valor do plano','Valor')
    col_tel = find('Telefone celular','Telefone','Telefone celular')
    # apply isNewProspect filter (remove if any field contains 'adicional')
    def is_new_prospect(row):
        plano = NORMALIZE(row.get(col_plano,'') or '')
        camp = NORMALIZE(row.get(col_campanha,'') or '')
        canal = NORMALIZE(row.get(col_canal,'') or '')
        for term in ['adicional']:
            if term in plano or term in camp or term in canal:
                return False
        return True
    filtered = [r for r in raw if is_new_prospect(r)]
    filteredCount = len(filtered)
    # dedupe by id / contrato / phone (digits only)
    seen = set(); deduped = []
    for r in filtered:
        idv = (r.get(col_id,'') or '').strip()
        contrato = (r.get(col_contrato,'') or '').strip()
        phone = (r.get(col_tel,'') or '')
        phone_digits = re.sub(r'\D','',phone)
        key = idv or contrato or phone_digits or None
        if not key:
            # fallback to entire row hash
            key = hash(tuple(sorted((k,str(v)) for k,v in r.items())))
        nk = str(key).strip()
        if nk in seen: continue
        seen.add(nk); deduped.append(r)
    dedupCount = len(deduped)
    # strictWon and ruleWon
    strictWon = 0; ruleWon = 0
    for r in filtered:
        status = NORMALIZE(r.get(col_status,'') or '')
        if status == 'vencemos' or status=='vencido' or status=='vencido(s)':
            strictWon += 1
        # ruleWon: status in won OR (contract non-empty & valor>0)
        hasWonStatus = (status=='vencemos')
        contractVal = (r.get(col_contrato,'') or '').strip()
        contractClean = NORMALIZE(contractVal)
        hasContract = contractClean not in bad_contract_vals
        price = parse_number(r.get(col_valor,'')) if col_valor else 0.0
        hasPrice = price>0
        hasFinancialProof = hasContract and hasPrice
        if hasWonStatus or hasFinancialProof:
            ruleWon += 1
    # print summary
    print(' rawCount:',rawCount)
    print(' filtered (isNewProspect):',filteredCount)
    print(' deduped:',dedupCount)
    print(' strictWon (status==vencemos):',strictWon)
    print(' ruleWon (status OR contract+price>0):',ruleWon)
    # print some samples of removed as additional
    removedAsAdditional = [r for r in raw if not is_new_prospect(r)]
    print(' removedAsAdditional:',len(removedAsAdditional))
    if len(removedAsAdditional)>0:
        print(' sample removed (first 5 ids):', [ (r.get(col_id), r.get(col_plano), r.get(col_campanha), r.get(col_canal)) for r in removedAsAdditional[:5] ])
