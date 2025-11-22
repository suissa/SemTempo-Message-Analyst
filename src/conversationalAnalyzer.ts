// src/conversationAnalyzer.ts

/**
 * Mapeamento de todas as chaves de características disponíveis.
 * As chaves em inglês são usadas internamente para o schema JSON.
 */
export const FeatureKeys = {
    // Características Semânticas
    clientIntent: 'Intenção Primária do Cliente',
    overallSentiment: 'Sentimento Geral do Cliente',
    negotiationStage: 'Estágio da Negociação',
    topicsDiscussed: 'Tópicos Principais Discutidos',

    // Características Temporais (que dependem do tempo)
    avgVendorResponseTime: 'TMR Médio do Vendedor (min)',
    conversationDuration: 'Duração Total da Conversa (min)',
    clientHesitationScore: 'Score de Hesitação do Cliente',
    predictedOutcome: 'Previsão de Desfecho',
} as const;

/**
 * Interface para a estrutura de uma única mensagem na conversa.
 */
export interface IMessage {
    text: string;
    timestamp: number; // Timestamp em milissegundos
    role: 'client' | 'vendor'; // Remetente da mensagem
}

/**
 * Interface para a estrutura de uma característica (Feature) extraída.
 */
export interface IFeature {
    name: string; // Nome amigável (em Português)
    key: keyof typeof FeatureKeys; // Chave de referência
    value: any; // O valor extraído pela LLM (string, número, etc.)
    type: 'semantic' | 'temporal';
    explanation?: string; // Justificativa da LLM
}

/**
 * Interface para a sugestão de próxima ação otimizada.
 */
export interface INextAction {
    action: string; // Ação recomendada (Ex: 'Enviar catálogo', 'Finalizar pedido')
    explanation: string; // Justificativa da recomendação
}

/**
 * Interface para a resposta final padronizada da análise.
 */
export interface IAnalysisResult {
    features: IFeature[];
    nextAction?: INextAction;
}

/**
 * Interface para o payload da requisição de análise.
 */
export interface IAnalysisRequest {
    messages: IMessage[];
    requestedFeatures: ('all' | keyof typeof FeatureKeys)[];
    goal?: string; // Objetivo geral da conversa
    productOrService?: string; // Produto ou serviço discutido
    includeNextAction?: boolean; // Se deve incluir sugestão de próxima ação
}

// URL da API e chave (conforme regras do ambiente)
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';
const API_KEY = ""; // A chave será fornecida pelo ambiente em tempo de execução

/**
 * Converte a lista de mensagens em um formato de texto legível para a LLM,
 * mantendo o carimbo de data/hora relativo para análise temporal.
 */
function formatConversationForLLM(messages: IMessage[]): string {
    if (messages.length === 0) return "A conversa está vazia.";

    const startTime = messages[0].timestamp;
    
    return messages.map(msg => {
        const timeElapsedSeconds = Math.round((msg.timestamp - startTime) / 1000);
        const timeElapsedMinutes = Math.floor(timeElapsedSeconds / 60);
        const timeElapsedRemainderSeconds = timeElapsedSeconds % 60;
        
        // Formato: [MIN:SEG] [CLIENTE/VENDEDOR]: Texto
        return `[${timeElapsedMinutes.toString().padStart(2, '0')}:${timeElapsedRemainderSeconds.toString().padStart(2, '0')}] [${msg.role.toUpperCase()}]: ${msg.text}`;
    }).join('\n');
}

/**
 * Constrói o System Instruction para guiar a LLM.
 */
function buildSystemInstruction(req: IAnalysisRequest): string {
    const requestedKeys = req.requestedFeatures.includes('all') 
        ? Object.keys(FeatureKeys) 
        : req.requestedFeatures;

    const featureList = requestedKeys
        .map(key => `- ${FeatureKeys[key as keyof typeof FeatureKeys]} (${key})`)
        .join('\n');

    let instruction = `Você é um Analista Semântico de Vendas, especialista em atendimento ao cliente e otimização de funil. 
    Sua tarefa é analisar uma transcrição de chat do WhatsApp entre um cliente e um vendedor.
    
    Características Solicitadas (devem ser retornadas no array 'features'):
    ${featureList}

    Metas e Contexto Adicional:
    - Objetivo da Conversa (Opcional): ${req.goal || 'Não fornecido'}
    - Produto/Serviço (Opcional): ${req.productOrService || 'Não fornecido'}
    
    Instruções Específicas:
    1. Baseie-se apenas no texto formatado da conversa.
    2. Para características temporais (ex: TMR, Duração), utilize os timestamps relativos fornecidos ([MIN:SEG]) para seus cálculos e explicações.
    3. Assegure que o retorno seja um objeto JSON válido, aderindo estritamente ao 'responseSchema'.
    4. O 'value' para TMR e Duração deve ser numérico (float) em minutos.
    `;

    if (req.includeNextAction) {
        instruction += `\n5. Você DEVE fornecer a próxima ação OTIMIZADA para o VENDEDOR (campo 'nextAction') e a respectiva 'explanation' (explicação). A ação deve ser prática e acionável.`;
    } else {
        instruction += `\n5. NÃO inclua o campo 'nextAction' no JSON de saída.`;
    }

    return instruction;
}


/**
 * Executa a análise semântica e temporal da conversa utilizando a API da Gemini.
 */
export async function analyzeConversation(req: IAnalysisRequest): Promise<IAnalysisResult> {
    const formattedConversation = formatConversationForLLM(req.messages);
    const systemInstruction = buildSystemInstruction(req);

    const requestedKeys = req.requestedFeatures.includes('all') 
        ? Object.keys(FeatureKeys) as (keyof typeof FeatureKeys)[]
        : req.requestedFeatures as (keyof typeof FeatureKeys)[];
    
    // Constrói o schema dinâmico para as características solicitadas
    const requiredFeaturesSchema = requestedKeys.map(key => ({
        type: 'OBJECT',
        properties: {
            name: { type: 'STRING', description: FeatureKeys[key] },
            key: { type: 'STRING', enum: [key] },
            value: { type: 'STRING', description: `O valor extraído para ${FeatureKeys[key]}. Para tempo (TMR, Duração), use um número (float) em minutos.` },
            type: { type: 'STRING', enum: (['clientIntent', 'overallSentiment', 'negotiationStage', 'topicsDiscussed'].includes(key) ? ['semantic'] : ['temporal']) },
            explanation: { type: 'STRING', description: `Explicação/justificativa da LLM para o valor atribuído.` }
        },
        propertyOrdering: ['name', 'key', 'value', 'type', 'explanation']
    }));

    // Schema para o objeto INextAction
    const nextActionSchema = {
        type: 'OBJECT',
        properties: {
            action: { type: 'STRING', description: 'A próxima ação otimizada para o vendedor.' },
            explanation: { type: 'STRING', description: 'O porquê dessa ação ser a mais otimizada no momento.' }
        },
        propertyOrdering: ['action', 'explanation']
    };

    // Schema da Resposta Principal (IAnalysisResult)
    const responseSchema = {
        type: "OBJECT",
        properties: {
            features: { type: "ARRAY", items: { type: "OBJECT", properties: requiredFeaturesSchema[0].properties } },
            ...(req.includeNextAction ? { nextAction: nextActionSchema } : {})
        },
        propertyOrdering: ['features', 'nextAction']
    };

    const userQuery = `Analise a transcrição abaixo (tempo relativo em [MIN:SEG] e o contexto. Retorne APENAS o JSON conforme o schema.

    --- TRANSCRIÇÃO ---
    ${formattedConversation}
    --- FIM TRANSCRIÇÃO ---
    `;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    };

    // Lógica de Retry com Backoff Exponencial
    const maxRetries = 3;
    let lastError: Error | undefined = undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API Error ${response.status}: ${errorBody}`);
            }

            const result = await response.json();
            
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!jsonText) {
                throw new Error("Resposta da LLM não continha texto JSON válido.");
            }

            const parsedJson: IAnalysisResult = JSON.parse(jsonText);
            return parsedJson;

        } catch (error) {
            lastError = error as Error;
            const delay = Math.pow(2, attempt) * 1000;
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error("Análise falhou após todas as tentativas:", lastError);
    throw new Error(`Não foi possível analisar a conversa: ${lastError?.message || 'Erro desconhecido'}`);
      }
