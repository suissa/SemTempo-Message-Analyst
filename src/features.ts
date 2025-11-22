export const SemanticFeatures = {
  clientIntent: "Intenção Primária do Cliente",
  overallSentiment: "Sentimento Geral do Cliente",
  topicsDiscussed: "Tópicos Discutidos",
  negotiationStage: "Estágio da Negociação",
  emotionProfile: "Perfil Emocional",
  objectionTypes: "Tipos de Objeção",
  urgencyLevel: "Nível de Urgência",
  trustLevel: "Nível de Confiança",
  rapportScore: "Score de Rapport",
  buyingTemperature: "Temperatura de Compra"
} as const;

export const TemporalFeatures = {
  avgVendorResponseTime: "TMR Médio do Vendedor",
  avgClientResponseTime: "TMR Médio do Cliente",
  conversationDuration: "Duração da Conversa",
  hesitationGaps: "Gaps de Hesitação",
  escalationSpeed: "Velocidade de Escalada da Conversa",
  timeToFirstIntent: "Tempo até a Primeira Intenção",
  volatilityOfTiming: "Volatilidade Temporal",
  finalMomentumScore: "Score Final de Momentum"
} as const;

export const FeatureRegistry = {
  ...SemanticFeatures,
  ...TemporalFeatures
};

export type FeatureKey = keyof typeof FeatureRegistry; 
