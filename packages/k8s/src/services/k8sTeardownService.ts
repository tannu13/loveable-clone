import {
  ApiException,
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  NetworkingV1Api,
} from "@kubernetes/client-node";
import { withActiveSpan } from "@repo/observability";
import { consoleLogger } from "../logger";
import type { K8sBaseConfig, Logger } from "../types";

export class K8sTeardownService {
  protected readonly k8sApi: CoreV1Api;
  protected readonly appsApi: AppsV1Api;
  protected readonly networkingApi: NetworkingV1Api;
  protected readonly namespace: string;
  protected readonly logger: Logger;

  constructor(config: K8sBaseConfig, logger: Logger = consoleLogger) {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    this.k8sApi = kc.makeApiClient(CoreV1Api);
    this.appsApi = kc.makeApiClient(AppsV1Api);
    this.networkingApi = kc.makeApiClient(NetworkingV1Api);

    this.namespace = config.k8sNamespace;
    this.logger = logger;
  }

  protected getPvcName(conversationId: string): string {
    return `pvc-${conversationId}`;
  }

  protected getPreviewServiceName(conversationId: string): string {
    return `preview-${conversationId}`;
  }

  protected getPreviewIngressName(conversationId: string): string {
    return `preview-${conversationId}`;
  }

  protected getDeploymentName(conversationId: string): string {
    return `conversation-${conversationId}`;
  }

  async teardownInfrastructure(conversationId: string) {
    await withActiveSpan("k8s-cluster.teardown", async () => {
      this.logger.info("Tearing down conversation cluster");
      await Promise.all([
        this.deleteConversationDeployment(conversationId),
        this.deletePreviewService(conversationId),
        this.deletePreviewIngress(conversationId),
        this.deleteWorkspacePVC(conversationId),
      ]);
    });
  }

  async deleteWorkspacePVC(conversationId: string) {
    const pvcName = this.getPvcName(conversationId);

    try {
      await this.k8sApi.deleteNamespacedPersistentVolumeClaim({
        name: pvcName,
        namespace: this.namespace,
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 404) {
        // PVC already gone, nothing left to do.
        this.logger.error(`PVC resource for ${conversationId} already deleted`);
        return;
      }
      throw err;
    }
  }

  async deletePreviewService(conversationId: string) {
    const serviceName = this.getPreviewServiceName(conversationId);

    try {
      await this.k8sApi.deleteNamespacedService({
        name: serviceName,
        namespace: this.namespace,
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 404) {
        this.logger.error(
          `Service resource for ${conversationId} already deleted`,
        );
        return;
      }
      throw err;
    }
  }

  async deletePreviewIngress(conversationId: string) {
    const ingressName = this.getPreviewIngressName(conversationId);

    try {
      await this.networkingApi.deleteNamespacedIngress({
        name: ingressName,
        namespace: this.namespace,
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 404) {
        this.logger.error(
          `Ingress resource for ${conversationId} already deleted`,
        );
        return;
      }
      throw err;
    }
  }

  async deleteConversationDeployment(conversationId: string) {
    const deploymentName = this.getDeploymentName(conversationId);

    try {
      await this.appsApi.deleteNamespacedDeployment({
        name: deploymentName,
        namespace: this.namespace,
      });
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 404) {
        this.logger.error(
          `Deployment resource for ${conversationId} already deleted`,
        );
        return;
      }
      throw err;
    }
  }
}
