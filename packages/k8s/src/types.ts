export interface K8sBaseConfig {
  k8sNamespace: string;
}

export interface K8sProvisioningConfig {
  projectPreviewProtocol: string;
  projectPreviewBaseDomain: string;
  previewAppPort: number;
  k8sIngressClassName: string;
  agentDockerImagePath: string;
  nodeEnv: string;
  clusterRedisAccessUrl: string;
  geminiApiKey: string;
  appRunnerDockerImagePath: string;
  appRunnerPort: number;
}

export type K8sServiceConfig = K8sBaseConfig & K8sProvisioningConfig;

export interface Logger {
  info(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
}
