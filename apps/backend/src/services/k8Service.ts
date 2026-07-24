import { ApiException, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import env, { isDev } from "../env";

export class K8Service {
  private k8sApi: CoreV1Api;
  constructor() {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    this.k8sApi = kc.makeApiClient(CoreV1Api);
  }

  private getPvcName(conversationId: string): string {
    return `pvc-${conversationId}`;
  }

  private getConfigMapName() {
    return "runner-script-config";
  }

  async ensureWorkspacePVC(conversationId: string) {
    const pvcName = this.getPvcName(conversationId);

    try {
      await this.k8sApi.createNamespacedPersistentVolumeClaim({
        namespace: env.K8_NAMESPACE,
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

  async ensureConversationPod(conversationId: string) {
    const podName = `conversation-${conversationId}`;

    try {
      await this.k8sApi.createNamespacedPod({
        namespace: env.K8_NAMESPACE,
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
                  { name: "K8_NAMESPACE", value: env.K8_NAMESPACE },
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
                    name: "AWS_BUCKET_NAME",
                    value:
                      "s30-loveable-clone-chat-bucket-410940411202-ap-south-1-an",
                  },
                  {
                    name: "DATABASE_URL",
                    value:
                      "postgresql://perps_user:mysecretpasswordfordb@host.minikube.internal:5432/loveable_clone",
                  },
                ],
              },
              {
                name: "app-runner",
                image: "node:18-alpine",
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
                command: ["node", "/scripts/app-runner-configmap.cjs"],
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
