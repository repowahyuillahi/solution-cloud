import "dotenv/config";
import { defineConfig } from "prisma/config";

// The TENANT_DATABASE_URL is set dynamically per tenant. For migrations and
// generation against a specific tenant, set TENANT_DATABASE_URL in your
// environment (e.g., file:./databases/tenants/<slug>.sqlite). For pure
// generation purposes a placeholder is sufficient.
export default defineConfig({
  schema: "prisma/schema-tenant.prisma",
  migrations: {
    path: "prisma/migrations-tenant",
  },
  datasource: {
    url:
      process.env.TENANT_DATABASE_URL ??
      "file:./databases/tenants/_template.sqlite",
  },
});
