import { createServiceRoleClient } from "../lib/supabase-service";

type ClubSeed = {
  name: string;
  email: string;
};

const OFFICIAL_CLUBS: ClubSeed[] = [
  {
    name: "San Andres Padel Club",
    email: "soporte.iplanetar@gmail.com",
  },
  {
    name: "Schwank Tennis & Padel Center",
    email: "soporte.somoselnexo@gmail.com",
  },
];

async function getOwnerIdByEmail(email: string) {
  const supabase = createServiceRoleClient();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Error buscando usuario ${email}: ${error.message}`);
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      return user.id;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function run() {
  const supabase = createServiceRoleClient();
  const inserted: Array<{ id: string; name: string | null; owner_id: string | null }> = [];
  const warnings: string[] = [];

  for (const club of OFFICIAL_CLUBS) {
    const ownerId = await getOwnerIdByEmail(club.email);

    if (!ownerId) {
      warnings.push(
        `No existe un usuario en auth.users con email ${club.email}. Se inserta "${club.name}" con owner_id null.`
      );
    }

    const { data, error } = await supabase
      .from("clubs")
      .insert({
        name: club.name,
        owner_id: ownerId,
        location: null,
        address: null,
        contact_phone: null,
      })
      .select("id, name, owner_id")
      .single();

    if (error) {
      throw new Error(`Error insertando club "${club.name}": ${error.message}`);
    }

    inserted.push(data);
  }

  console.log("Clubes oficiales insertados correctamente:");
  console.log(inserted);
  if (warnings.length > 0) {
    console.warn("Advertencias:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error inesperado";
  console.error("Fallo al insertar clubes oficiales:", message);
  process.exit(1);
});
