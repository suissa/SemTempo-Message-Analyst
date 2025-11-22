export interface IMessage {
  text: string;
  timestamp: number;
  role: "client" | "vendor";
}

export interface IFeature {
  name: string;
  key: string;
  value: any;
  type: "semantic" | "temporal";
  explanation?: string;
}

export interface INextAction {
  action: string;
  explanation: string;
}

export interface IAnalysisRequest {
  messages: IMessage[];
  requested: FeatureKey[] | "all";
  goal?: string;
  productOrService?: string;
  includeNextAction?: boolean;
}

export interface IAnalysisResult {
  features: IFeature[];
  nextAction?: INextAction;
} 
