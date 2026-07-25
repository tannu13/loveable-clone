import z from "zod";

function isPackageName(packageName: string) {
  return !packageName.trim().startsWith("-"); // maybe later add more checks
}
export const PackageOperationSchema = z.object({
  packages: z
    .union([
      z.string().min(1).refine(isPackageName, "Invalid package name"),
      z
        .array(z.string().min(1).refine(isPackageName, "Invalid package name"))
        .min(1),
    ])
    .transform((value) => (Array.isArray(value) ? value : [value])),
});
export type TPackageOperationSchema = z.infer<typeof PackageOperationSchema>;
