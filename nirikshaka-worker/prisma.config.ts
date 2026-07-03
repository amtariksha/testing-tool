import "dotenv/config";
import { defineConfig } from "prisma/config";

// Schema is a copy of ../nirikshaka/prisma/schema.prisma (run `pnpm sync:schema`).
// Migrations are owned by the main app — never create migrations from here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
