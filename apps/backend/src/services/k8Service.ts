import { ApiException, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import env, { isDev } from "../env";

export class K8Service {
  private k8sApi: CoreV1Api;
  constructor() {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    this.k8sApi = kc.makeApiClient(CoreV1Api);
  }

  async init() {
    try {
      await this.k8sApi.createNamespace({
        body: {
          metadata: {
            name: env.K8_NAMESPACE,
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 409) {
        // console.log("Namespace already exists.");
        return;
      }

      throw err;
    }
  }

  async ensureConversationPod(conversationId: string) {
    if (isDev) {
      return;
    }
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
            containers: [
              {
                name: "agent-worker",
                image: env.AGENT_DOCKER_IMAGE_PATH,
                env: [
                  { name: "REDIS_URL", value: env.CLUSTER_REDIS_ACCESS_URL },
                  { name: "K8_NAMESPACE", value: env.K8_NAMESPACE },
                  { name: "CONVERSATION_ID", value: conversationId },
                  { name: "GEMINI_API_KEY", value: env.GEMINI_API_KEY },
                ],
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
