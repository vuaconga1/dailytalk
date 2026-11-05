/**
 * Create (or reset the password of) the first admin account.
 *
 *   ADMIN_EMAIL=admin@wewin.edu.vn ADMIN_PASSWORD=... npm run seed:admin
 *   npm run seed:admin -- --email admin@wewin.edu.vn --password secret123 --name "Admin WeWIN"
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = (flag("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = flag("password") ?? process.env.ADMIN_PASSWORD ?? "";
  const name = flag("name") ?? process.env.ADMIN_NAME ?? "Admin WeWIN";
  if (!email.includes("@") || password.length < 8) {
    throw new Error("Cần --email và --password (≥ 8 ký tự) hoặc ADMIN_EMAIL / ADMIN_PASSWORD.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN", status: "ACTIVE" },
    update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
  });
  console.log(`Admin sẵn sàng: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
