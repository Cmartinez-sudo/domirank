/**
 * seed-test-users.ts
 * ==================
 * Crea 10 usuarios de prueba en Supabase para testear torneos de 8+ jugadores.
 *
 * Requisitos:
 *   - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL como fallback)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   en .env.local (se leen vía dotenv o variables de entorno del shell).
 *
 * Uso:
 *   pnpm seed:users
 *   # o directamente:
 *   tsx scripts/seed-test-users.ts
 *
 * Idempotente: si el usuario ya existe, se salta la creación y actualiza el profile.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Cargar .env.local si existe ─────────────────────────────────────────────
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No existe .env.local, continuar con env del shell
  }
}

loadEnvLocal();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error(
    "ERROR: falta SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) en el entorno."
  );
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    "AVISO: usando NEXT_PUBLIC_SUPABASE_URL como fallback para SUPABASE_URL.\n"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "TestUser2026!";

type TestUser = {
  email: string;
  username: string;
  display_name: string;
  country: string;
};

const TEST_USERS: TestUser[] = [
  { email: "test1@domirank.test",  username: "test_carlos",   display_name: "Carlos Test",   country: "VE" },
  { email: "test2@domirank.test",  username: "test_maria",    display_name: "María Test",    country: "DO" },
  { email: "test3@domirank.test",  username: "test_roberto",  display_name: "Roberto Test",  country: "CU" },
  { email: "test4@domirank.test",  username: "test_luisa",    display_name: "Luisa Test",    country: "PR" },
  { email: "test5@domirank.test",  username: "test_pedro",    display_name: "Pedro Test",    country: "VE" },
  { email: "test6@domirank.test",  username: "test_ana",      display_name: "Ana Test",      country: "DO" },
  { email: "test7@domirank.test",  username: "test_jorge",    display_name: "Jorge Test",    country: "CU" },
  { email: "test8@domirank.test",  username: "test_sofia",    display_name: "Sofía Test",    country: "PR" },
  { email: "test9@domirank.test",  username: "test_miguel",   display_name: "Miguel Test",   country: "VE" },
  { email: "test10@domirank.test", username: "test_elena",    display_name: "Elena Test",    country: "DO" },
];

async function upsertProfile(userId: string, user: TestUser) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: user.username,
        display_name: user.display_name,
        country: user.country,
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`upsert profile: ${error.message}`);
}

async function processUser(user: TestUser): Promise<"created" | "exists"> {
  // Intentar crear el usuario
  const { data: result, error: createErr } =
    await supabase.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: user.username,
        display_name: user.display_name,
      },
    });

  if (createErr) {
    // Supabase devuelve "User already registered" si ya existe
    if (
      createErr.message.includes("already") ||
      createErr.message.includes("duplicate") ||
      createErr.message.includes("exists")
    ) {
      // Buscar el usuario existente para actualizar el profile
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === user.email);
      if (existing) {
        await upsertProfile(existing.id, user);
        console.log(`  [ya existe] ${user.email} → profile actualizado`);
      } else {
        console.warn(`  [skip]      ${user.email} → ya existe pero no se pudo encontrar`);
      }
      return "exists";
    }
    throw new Error(`createUser(${user.email}): ${createErr.message}`);
  }

  if (!result?.user) throw new Error(`createUser(${user.email}): sin respuesta`);

  await upsertProfile(result.user.id, user);
  console.log(`  [creado]    ${user.email} (id: ${result.user.id})`);
  return "created";
}

async function main() {
  console.log("=== DomiRank — Seed de usuarios de prueba ===\n");
  console.log(`Proyecto : ${SUPABASE_URL}`);
  console.log(`Password : ${PASSWORD}\n`);
  console.log("Procesando usuarios...\n");

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const user of TEST_USERS) {
    try {
      const status = await processUser(user);
      if (status === "created") created++; else skipped++;
    } catch (e) {
      failed++;
      console.error(`  [error]     ${user.email}:`, (e as Error).message);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Creados : ${created}`);
  console.log(`  Ya existían: ${skipped}`);
  console.log(`  Fallidos: ${failed}`);
  console.log(`\nCredenciales para login:`);
  for (const u of TEST_USERS) {
    console.log(`  ${u.email.padEnd(26)} / ${PASSWORD}`);
  }
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
