import { ApiException } from "@kubernetes/client-node";
import { withActiveSpan } from "@repo/observability";
import { K8sTeardownService } from "./k8sTeardownService";
import type { K8sServiceConfig, Logger } from "../types";

export class K8Service extends K8sTeardownService {
  constructor(
    private readonly config: K8sServiceConfig,
    logger?: Logger,
  ) {
    super(config, logger);
  }

  getPreviewUrl(conversationId: string): string {
    return `${this.config.projectPreviewProtocol}://${conversationId}.${this.config.projectPreviewBaseDomain}`;
  }

  async ensureInfrastructure(conversationId: string) {
    await withActiveSpan("k8s-cluster.ensure", async () => {
      this.logger.info("Provisioning / ensuring conversation cluster");
      // The deployment mounts the PVC, so that has to exist first.
      await this.ensureWorkspacePVC(conversationId);
      await Promise.all([
        this.ensureConversationDeployment(conversationId),
        this.ensurePreviewService(conversationId),
        this.ensurePreviewIngress(conversationId),
      ]);
    });
  }

  async ensureWorkspacePVC(conversationId: string) {
    const pvcName = this.getPvcName(conversationId);

    try {
      await this.k8sApi.createNamespacedPersistentVolumeClaim({
        namespace: this.namespace,
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
        this.logger.error(`PVC resource for ${conversationId} already exists`);
        return;
      }
      throw err;
    }
  }

  async ensurePreviewService(conversationId: string) {
    const serviceName = this.getPreviewServiceName(conversationId);

    try {
      await this.k8sApi.createNamespacedService({
        namespace: this.namespace,
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
                targetPort: this.config.previewAppPort,
              },
            ],
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 409) {
        this.logger.error(
          `Service resource for ${conversationId} already exists`,
        );
        return;
      }
      throw err;
    }
  }

  async ensurePreviewIngress(conversationId: string) {
    const ingressName = this.getPreviewIngressName(conversationId);
    const serviceName = this.getPreviewServiceName(conversationId);
    const host = `${conversationId}.${this.config.projectPreviewBaseDomain}`;

    try {
      await this.networkingApi.createNamespacedIngress({
        namespace: this.namespace,
        body: {
          metadata: {
            name: ingressName,
            labels: {
              app: "conversation-preview",
              conversationId,
            },
          },
          spec: {
            ingressClassName: this.config.k8sIngressClassName,
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
        this.logger.error(
          `Ingress resource for ${conversationId} already exists`,
        );
        return;
      }
      throw err;
    }
  }

  async ensureConversationDeployment(conversationId: string) {
    const deploymentName = this.getDeploymentName(conversationId);

    try {
      await this.appsApi.createNamespacedDeployment({
        namespace: this.namespace,
        body: {
          metadata: {
            name: deploymentName,
            namespace: this.namespace,
            labels: {
              app: "conversation-space",
              conversationId,
            },
          },
          spec: {
            replicas: 1,
            strategy: {
              type: "Recreate", // Kills old Pod first so PVC is unlocked before new Pod starts
            },
            selector: {
              matchLabels: {
                app: "conversation-space",
                conversationId: conversationId,
              },
            },
            template: {
              metadata: {
                labels: {
                  app: "conversation-space",
                  conversationId: conversationId,
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
                ],
                containers: [
                  {
                    name: "agent-worker",
                    image: this.config.agentDockerImagePath,
                    volumeMounts: [
                      {
                        name: "workspace-storage",
                        mountPath: "/workspace", // Agent writes code here
                      },
                    ],
                    env: [
                      { name: "NODE_ENV", value: this.config.nodeEnv },
                      {
                        name: "REDIS_URL",
                        value: this.config.clusterRedisAccessUrl,
                      },
                      {
                        name: "namespace",
                        value: this.namespace,
                      },
                      { name: "CONVERSATION_ID", value: conversationId },
                      {
                        name: "GEMINI_API_KEY",
                        value: this.config.geminiApiKey,
                      },
                      { name: "AWS_REGION", value: "ap-south-1" },
                      { name: "AWS_ACCESS_KEY_ID", value: "fake-local-key" },
                      {
                        name: "AWS_SECRET_ACCESS_KEY",
                        value: "fake-local-secret",
                      },
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
                      {
                        name: "AWS_USER_APP_BUCKET_NAME",
                        value:
                          "s30-loveable-clone-user-app-backup-410940411202-ap-south-1-an",
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
                    image: this.config.appRunnerDockerImagePath,
                    env: [
                      {
                        name: "APP_PORT",
                        value: `${this.config.appRunnerPort}`,
                      },
                      { name: "NODE_ENV", value: this.config.nodeEnv },
                      { name: "APP_DIR", value: "/user-app" },
                      { name: "DEV_HOST", value: "0.0.0.0" },
                      {
                        name: "DEV_PORT",
                        value: `${this.config.previewAppPort}`,
                      },
                    ],
                    ports: [
                      {
                        name: "preview",
                        containerPort: this.config.previewAppPort,
                      },
                      {
                        name: "runner-api",
                        containerPort: this.config.appRunnerPort,
                      },
                    ],
                    volumeMounts: [
                      {
                        name: "workspace-storage",
                        mountPath: "/user-app", // Runner reads code from here
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      });
    } catch (err) {
      if (err instanceof ApiException && err.code === 409) {
        // Pod already exists.
        this.logger.error(
          `Deployment resource for ${conversationId} already exists`,
        );
        return;
      }

      throw err;
    }
  }
}
