import z from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  REDIS_URL: z
    .string()
    .startsWith("redis://")
    .default("redis://localhost:6379"),
  K8_NAMESPACE: z.string().default("loveable-clone"),
  CONVERSATION_ID: z
    .string()
    // .min(1)
    .default("44d2d019-526f-405d-b7ec-69fb4e5282b1"),
  GEMINI_API_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_BUCKET_NAME: z.string().min(1),
  MINIO_ENDPOINT: z.string().min(1),
});

type Env = z.infer<typeof EnvSchema>;
let env: Env;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
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

export default env;
export { env };
