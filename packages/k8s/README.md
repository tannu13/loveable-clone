# @repo/k8s

Manages the Kubernetes resources backing a conversation: the workspace PVC, the
conversation Deployment (agent-worker + app-runner), and the preview
Service/Ingress.

The package exposes two entry points so that a consumer only has to supply the
config it actually has.

## `K8sTeardownService` — deleting only

Deleting a resource needs nothing but its name and namespace, so this can be
constructed with no config and no logger at all. This is what the conversation
lifecycle worker uses.

```ts
import { K8sTeardownService } from "@repo/k8s";

const k8s = new K8sTeardownService();
await k8s.teardownInfrastructure(conversationId);
```

Both arguments are optional and can be supplied independently:

```ts
new K8sTeardownService({ k8sNamespace: "conversations" }, logger);
```

## `K8Service` — provisioning and deleting

Creating resources requires knowing which images to run, where the preview is
served from, and what to inject into the containers, so this class requires the
full `K8sServiceConfig`. It extends `K8sTeardownService`, so it also has the
whole teardown surface. This is what the backend API uses.

```ts
import { K8Service, type K8sServiceConfig } from "@repo/k8s";

const k8s = new K8Service(config satisfies K8sServiceConfig, logger);
await k8s.ensureInfrastructure(conversationId);
```

## Adding config

`K8sBaseConfig` holds what every consumer needs and every field in it must stay
optional with a default. `K8sProvisioningConfig` holds what is only needed to
create resources. Put new fields in whichever of the two matches how the value
is used — a teardown-only consumer should never have to invent a value it has
no way of knowing.
