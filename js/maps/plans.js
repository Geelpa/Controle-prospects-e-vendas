const PLAN_MAP = {
    "109": {
        name: "Exclusivo Residencial Irlanda - 200Mb PME - ",
        price: 90
    },
    "108": {
        name: "Exclusivo Pekerson - 200Mb PME - ",
        price: 122.11
    },
    "107": {
        name: "Funcionários Essential - 300Mb",
        price: 0
    },
    "106": {
        name: "Adicional Premium - 1Gb",
        price: 111
    },
    "105": {
        name: "Adicional Power - 800Mb",
        price: 111
    },
    "104": {
        name: "Adicional Plus - 600Mb",
        price: 111
    },
    "103": {
        name: "Adicional Start - 500Mb",
        price: 111
    },
    "101": {
        name: "Premium - 1Gb",
        price: 222.11
    },
    "100": {
        name: "Power - 800Mb",
        price: 166.55
    },
    "99": {
        name: "Plus - 600Mb",
        price: 144.33
    },
    "98": {
        name: "Start - 500Mb",
        price: 122.11
    },
    "97": {
        name: "Essential - 300Mb",
        price: 111
    },
    "96": {
        name: "200Mb Promocional",
        price: 111
    },
    "95": {
        name: "Plano Adicionai - 400Mb em DOBRO PF + Watch + HBO",
        price: 111
    },
    "94": {
        name: "Plano Adicional - 300Mb em DOBRO PF + Watch",
        price: 111
    },
    "93": {
        name: "1Gb VPU ",
        price: 222.11
    },
    "92": {
        name: "Plano Adicional 200Mb em DOBRO VPU - PF",
        price: 111
    },
    "91": {
        name: "Plano Adicional 1Gb VPU",
        price: 111
    },
    "90": {
        name: "Funcionários 100Mb",
        price: 0
    },
    "89": {
        name: "100Mb VPU PF ",
        price: 111
    },
    "88": {
        name: "200Mb em DOBRO VPU - PF ",
        price: 122.11
    },
    "87": {
        name: "300Mb em DOBRO PF  + Watch",
        price: 144.33
    },
    "86": {
        name: "400Mb em DOBRO PF  + Watch + HBO",
        price: 166.55
    },
    "85": {
        name: "100 Mb Link Dedicado com IP Fixo - ",
        price: 555.44
    },
    "84": {
        name: "1Gb + Telefonia + 1 IP fixo PME ",
        price: 277.66
    },
    "83": {
        name: "400Mb + Telefonia + 1 IP fixo PME ",
        price: 166.55
    },
    "82": {
        name: "200Mb PME - ",
        price: 144.33
    },
    "81": {
        name: "1Gb VPU - Pessoa Jurídica",
        price: 222.11
    },
    "80": {
        name: "300Mb em DOBRO PJ +Watch+Paramount",
        price: 144.33
    },
    "79": {
        name: "400Mb em DOBRO PJ + Watch + Paramount + HBO",
        price: 166.55
    },
    "78": {
        name: "100Mb VPU Pessoa Jurídica",
        price: 111
    },
    "77": {
        name: "200Mb em DOBRO VPU - PJ",
        price: 122.11
    },
    "76": {
        name: "50 Mb LINK DEDICADO COM IP FIXO",
        price: 555.44
    },
    "75": {
        name: "1Gb VPU",
        price: 222.11
    },
    "72": {
        name: "300Mb em DOBRO PF + Watch",
        price: 144.33
    },
    "71": {
        name: "400Mb em DOBRO PF + Watch + HBO",
        price: 166.55
    },
    "70": {
        name: "300Mb + 300Mb Residencial VPU",
        price: 144.33
    },
    "69": {
        name: "600Mb VPU",
        price: 277.67
    },
    "68": {
        name: "500 Mb VPU",
        price: 222.11
    },
    "67": {
        name: "400Mb VPU",
        price: 166.55
    },
    "66": {
        name: "300Mb VPU",
        price: 144.33
    },
    "65": {
        name: "200Mb VPU",
        price: 122.11
    },
    "64": {
        name: "100Mb VPU",
        price: 111
    },
    "63": {
        name: "200Mb em DOBRO VPU - PF",
        price: 122.11
    },
    "60": {
        name: "Plano 1Gb Premium - Anual",
        price: 2998.8
    },
    "59": {
        name: "400Mb + Telefonia + 1 IP fixo PME - ",
        price: 166.55
    },
    "58": {
        name: "200Mb PME - ",
        price: 144.32
    },
    "57": {
        name: "100Mb VPU PF ",
        price: 111
    },
    "54": {
        name: "200Mb em DOBRO VPU - PF ",
        price: 122.11
    },
    "53": {
        name: "300Mb em DOBRO PF  + Watch + Paramount",
        price: 144.32
    },
    "52": {
        name: "400Mb em DOBRO PF  + Watch + Paramount + HBO",
        price: 166.55
    },
    "51": {
        name: "1Gb VPU - Pessoa Jurídica",
        price: 222.11
    },
    "50": {
        name: "400Mb VPU - Pessoa Jurídica",
        price: 166.55
    },
    "49": {
        name: "200Mb VPU Pessoa Jurídica",
        price: 122.11
    },
    "48": {
        name: "300Mb em DOBRO PJ +Watch+Paramount",
        price: 144.32
    },
    "47": {
        name: "400Mb em DOBRO PJ + Watch + Paramount + HBO",
        price: 166.55
    },
    "46": {
        name: "100Mb VPU Pessoa Jurídica",
        price: 111
    },
    "45": {
        name: "200Mb em DOBRO VPU - PJ",
        price: 122.11
    },
    "44": {
        name: "TESTE-HUB",
        price: 0
    },
    "43": {
        name: "100Mb VPU - Serviço de Conexão de Internet",
        price: 0
    },
    "42": {
        name: "1Gb VPU",
        price: 222.11
    },
    "41": {
        name: "300Mb em dobro + Watch + Paramount",
        price: 0
    },
    "40": {
        name: "300Mb em DOBRO PF + Watch + Paramount",
        price: 144.32
    },
    "39": {
        name: "400Mb em DOBRO PF + Watch + Paramount + HBO",
        price: 166.55
    },
    "38": {
        name: "Funcionários 100Mb",
        price: 0
    },
    "37": {
        name: "300Mb + 300Mb Residencial VPU",
        price: 144.32
    },
    "36": {
        name: "200Mb em DOBRO VPU - PF",
        price: 122.11
    },
    "35": {
        name: "600Mb VPU",
        price: 277.66
    },
    "34": {
        name: "500 Mb VPU",
        price: 221.11
    },
    "33": {
        name: "400Mb Comercial VPU",
        price: 0
    },
    "32": {
        name: "400Mb VPU",
        price: 166.55
    },
    "31": {
        name: "300Mb VPU",
        price: 144.32
    },
    "30": {
        name: "200Mb VPU",
        price: 122.11
    },
    "29": {
        name: "100Mb VPU",
        price: 111
    },
    "28": {
        name: "100Mb Residencial VPU",
        price: 0
    },
    "27": {
        name: "400Mb Residencial VPU PROMOCIONAL",
        price: 277.66
    },
    "26": {
        name: "300Mb Residencial VPU PROMOCIONAL",
        price: 221.11
    },
    "25": {
        name: "200Mb Residencial VPU PROMOCIONAL",
        price: 166.55
    },
    "24": {
        name: "100Mb Residencial VPU PROMOCIONAL",
        price: 144.32
    },
    "23": {
        name: "50Mb Residencial VPU PROMOCIONAL",
        price: 111
    },
    "20": {
        name: "300Mb Comercial VPU",
        price: 221.11
    },
    "19": {
        name: "300Mb Residencial VPU",
        price: 221.11
    },
    "18": {
        name: "50 Mb LINK DEDICADO COM IP FIXO",
        price: 555.55
    },
    "17": {
        name: "teste banda liberada",
        price: 0
    },
    "16": {
        name: "100Mb Residencial- PROMOCIONAL",
        price: 149.9
    },
    "15": {
        name: "100Mb Comercial VPU",
        price: 144.32
    },
    "13": {
        name: "50Mb Comercial VPU",
        price: 111
    },
    "11": {
        name: "400Mb Comercial VPU",
        price: 277.66
    },
    "9": {
        name: "200Mb Comercial VPU",
        price: 166.55
    },
    "8": {
        name: "400Mb Residencial VPU",
        price: 277.66
    },
    "7": {
        name: "PROMOCIONAL *",
        price: 129.9
    },
    "6": {
        name: "100Mb Residencial VPU",
        price: 144.32
    },
    "4": {
        name: "50Mb Residencial VPU",
        price: 111
    },
    "1": {
        name: "200Mb Residencial VPU",
        price: 166.55
    }
}