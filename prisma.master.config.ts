import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema-master.prisma",
  migrations: {
    path: "prisma/migrations-master",
  },
  datasource: {
    url:
      process.env.MASTER_DATABASE_URL ?? "file:./databases/master.sqlite",
  },
});
