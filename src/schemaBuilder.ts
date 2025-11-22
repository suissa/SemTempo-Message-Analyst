import { FeatureRegistry, SemanticFeatures } from "./features";

export function buildFeatureSchema(key: string) {
  const isSemantic = key in SemanticFeatures;

  return {
    type: "OBJECT",
    properties: {
      name: { type: "STRING", description: FeatureRegistry[key] },
      key: { type: "STRING", enum: [key] },
      value: { type: "STRING" },
      type: { type: "STRING", enum: [isSemantic ? "semantic" : "temporal"] },
      explanation: { type: "STRING" }
    }
  };
}

export function buildDynamicSchema(keys: string[], includeNextAction: boolean) {
  return {
    type: "OBJECT",
    properties: {
      features: {
        type: "ARRAY",
        items: {
          oneOf: keys.map(k => buildFeatureSchema(k))
        }
      },
      ...(includeNextAction
        ? {
            nextAction: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING" },
                explanation: { type: "STRING" }
              }
            }
          }
        : {})
    }
  };
} 
