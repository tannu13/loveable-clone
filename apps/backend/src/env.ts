import z from "zod";

const EnvSchema = z
  .object({
    APP_PORT: z.coerce.number().positive().default(3000),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    APP_STAGE: z.enum(["dev", "prod"]).default("dev"),
    LOG_LEVEL: z
      .enum(["info", "debug", "error", "fatal", "silent", "trace", "warn"])
      .default("info"),
    JWT_SECRET: z.string().min(32).optional(),
    GEMINI_API_KEY: z.string().min(1),
    FRONTEND_URL: z.string().startsWith("http"),
    PROJECT_PREVIEW_URL: z.string().startsWith("http"),
    PROJECT_PREVIEW_BASE_DOMAIN: z.string().min(1).default("preview.local"),
    PROJECT_PREVIEW_PROTOCOL: z.enum(["http", "https"]).default("http"),
    K8S_INGRESS_CLASS_NAME: z.string().min(1).default("nginx"),
    DATABASE_URL: z.string().startsWith("postgresql://"),
    REDIS_URL: z.string().startsWith("redis://"),
    CLUSTER_REDIS_ACCESS_URL: z.string().startsWith("redis://"),
    K8S_NAMESPACE: z.string().default("loveable-clone"),
    AGENT_DOCKER_IMAGE_PATH: z
      .string()
      .default("tannnu13/loveable-clone-agent:latest"),
    APP_RUNNER_DOCKER_IMAGE_PATH: z
      .string()
      .default("tannnu13/loveable-clone-app-runner:latest"),
    APP_RUNNER_PORT: z.coerce.number().positive().default(8080),
    PREVIEW_APP_PORT: z.coerce.number().positive().default(5174),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (env.APP_STAGE === "prod" && !env.JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required in production",
      });
    }
  })
  .transform((env) => ({
    ...env,
    JWT_SECRET:
      env.JWT_SECRET ?? "development-only-jwt-secret-change-before-production",
  }));

type Env = z.infer<typeof EnvSchema>;
let env: Env;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    // not using logger here because this file gets imported before observability init and
    // pino instrumentation is missed if pino logger is imported before instrumentation is initialised
    console.error("Invalid environment variables", error);
    console.error(JSON.stringify(z.treeifyError(error), null, 2));

    error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      console.error(`  ${path}: ${issue.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export const isDev = env.APP_STAGE === "dev";

export default env;
export { env };
