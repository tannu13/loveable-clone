import {
  ApiException,
  CoreV1Api,
  KubeConfig,
  NetworkingV1Api,
} from "@kubernetes/client-node";
import env, { isDev } from "../env";

export class K8Service {
  private k8sApi: CoreV1Api;
  private networkingApi: NetworkingV1Api;

  constructor() {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    this.k8sApi = kc.makeApiClient(CoreV1Api);
    this.networkingApi = kc.makeApiClient(NetworkingV1Api);
  }

  private getPvcName(conversationId: string): string {
    return `pvc-${conversationId}`;
  }

  private getConfigMapName() {
    return "runner-script-config";
  }

  private getPreviewServiceName(conversationId: string): string {
    return `preview-${conversationId}`;
  }

  private getPreviewIngressName(conversationId: string): string {
    return `preview-${conversationId}`;
  }

  getPreviewUrl(conversationId: string): string {
    return `${env.PROJECT_PREVIEW_PROTOCOL}://${conversationId}.${env.PROJECT_PREVIEW_BASE_DOMAIN}`;
  }

  async ensureWorkspacePVC(conversationId: string) {
    const pvcName = this.getPvcName(conversationId);

    try {
      await this.k8sApi.createNamespacedPersistentVolumeClaim({
        namespace: env.K8S_NAMESPACE,
        body: {
          metadata: {
            name: pvcName,
            labels: {
              app: "conversation-space",
              conversationId,
            },
          },
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: {
              requests: {
                storage: "20Mi",
              },
            },
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 409) {
        // PVC already exists, so we can safely continue!
        return;
      }
      throw err;
    }
  }

  async ensurePreviewService(conversationId: string) {
    const serviceName = this.getPreviewServiceName(conversationId);

    try {
      await this.k8sApi.createNamespacedService({
        namespace: env.K8S_NAMESPACE,
        body: {
          metadata: {
            name: serviceName,
            labels: {
              app: "conversation-preview",
              conversationId,
            },
          },
          spec: {
            type: "ClusterIP",
            selector: {
              app: "conversation-space",
              conversationId,
            },
            ports: [
              {
                name: "preview",
                port: 80,
                targetPort: 5173,
              },
            ],
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 409) {
        return;
      }
      throw err;
    }
  }

  async ensurePreviewIngress(conversationId: string) {
    const ingressName = this.getPreviewIngressName(conversationId);
    const serviceName = this.getPreviewServiceName(conversationId);
    const host = `${conversationId}.${env.PROJECT_PREVIEW_BASE_DOMAIN}`;

    try {
      await this.networkingApi.createNamespacedIngress({
        namespace: env.K8S_NAMESPACE,
        body: {
          metadata: {
            name: ingressName,
            labels: {
              app: "conversation-preview",
              conversationId,
            },
          },
          spec: {
            ingressClassName: env.K8S_INGRESS_CLASS_NAME,
            rules: [
              {
                host,
                http: {
                  paths: [
                    {
                      path: "/",
                      pathType: "Prefix",
                      backend: {
                        service: {
                          name: serviceName,
                          port: {
                            number: 80,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 409) {
        return;
      }
      throw err;
    }
  }

  async ensureConversationPod(conversationId: string) {
    const podName = `conversation-${conversationId}`;

    try {
      await this.k8sApi.createNamespacedPod({
        namespace: env.K8S_NAMESPACE,
        body: {
          metadata: {
            name: podName,
            labels: {
              app: "conversation-space",
              conversationId,
            },
          },
          spec: {
            serviceAccountName: "agent-runner-sa", // RBAC ServiceAccount
            volumes: [
              {
                name: "workspace-storage",
                persistentVolumeClaim: {
                  claimName: this.getPvcName(conversationId), // Links to the PVC
                },
              },
              {
                name: "runner-script-vol",
                configMap: {
                  name: this.getConfigMapName(), // Points to the ConfigMap name
                },
              },
            ],
            containers: [
              {
                name: "agent-worker",
                image: env.AGENT_DOCKER_IMAGE_PATH,
                volumeMounts: [
                  {
                    name: "workspace-storage",
                    mountPath: "/workspace", // Agent writes code here
                  },
                ],
                env: [
                  { name: "NODE_ENV", value: env.NODE_ENV },
                  { name: "REDIS_URL", value: env.CLUSTER_REDIS_ACCESS_URL },
                  { name: "K8S_NAMESPACE", value: env.K8S_NAMESPACE },
                  { name: "CONVERSATION_ID", value: conversationId },
                  { name: "GEMINI_API_KEY", value: env.GEMINI_API_KEY },
                  { name: "AWS_REGION", value: "ap-south-1" },
                  { name: "AWS_ACCESS_KEY_ID", value: "fake-local-key" },
                  { name: "AWS_SECRET_ACCESS_KEY", value: "fake-local-secret" },
                  {
                    name: "MINIO_ENDPOINT",
                    value: "http://host.minikube.internal:9000",
                  },
                  {
                    name: "AWS_CHAT_BUCKET_NAME",
                    value:
                      "s30-loveable-clone-chat-bucket-410940411202-ap-south-1-an",
                  },
                  {
                    name: "AWS_STARTER_TEMPLATES_BUCKET_NAME",
                    value:
                      "s30-loveable-startertemplates-bucket-410940411202-ap-south-1-an",
                  },
                  { name: "WORKSPACE_DIR", value: "/workspace" },
                  {
                    name: "DATABASE_URL",
                    value:
                      "postgresql://perps_user:mysecretpasswordfordb@host.minikube.internal:5432/loveable_clone",
                  },
                  {
                    name: "APP_RUNNER_BASE_URL",
                    value: "http://127.0.0.1:8080",
                  },
                ],
              },
              {
                name: "app-runner",
                image: "oven/bun:alpine",
                ports: [
                  {
                    name: "preview",
                    containerPort: 5173,
                  },
                  {
                    name: "runner-api",
                    containerPort: 8080,
                  },
                ],
                volumeMounts: [
                  {
                    name: "workspace-storage",
                    mountPath: "/app", // Runner reads code from here
                  },
                  {
                    name: "runner-script-vol",
                    mountPath: "/scripts",
                  },
                ],
                command: ["bun", "/scripts/app-runner-configmap.cjs"],
              },
            ],
          },
        },
      });
    } catch (err) {
      if (err instanceof ApiException && err.code === 409) {
        // Pod already exists.
        return;
      }

      throw err;
    }
  }
}
