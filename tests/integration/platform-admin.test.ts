import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { MemoryMailer } from "@/lib/email/port";
import { DEFAULT_PREFERENCES } from "@/lib/notifications/defaults";
import { planScheduled } from "@/lib/notifications/plan";
import { PLATFORM_ADMIN_LABEL } from "@/lib/platform/labels";
import { InvitationService } from "@/services/invitation-service";
import { NotificationGenerator } from "@/services/notifications/generator";
import { MembershipAdminService } from "@/services/platform/membership-admin-service";
import { OrganizationAdminService } from "@/services/platform/organization-admin-service";
import { UserAdminService } from "@/services/platform/user-admin-service";
import { TaskService } from "@/services/tasks/task-service";

import { signIn } from "./fair-support";
import { adminClient, countNotifications, userIdByEmail } from "./notifications-support";

/**
 * KAM-26 · El super admin gestiona equipos con su propia sesión, bajo RLS,
 * contra la base local de verdad (spec `platform-administration`).
 *
 * Escenarios: «Adding an existing account as owner», «Assigning two
 * organizations at once», «The last owner stays», «Renaming a membership»,
 * y los de *A platform admin is not part of an organization's team*: «Not
 * listed among the members», «Not assignable», «No notifications from
 * foreign organizations».
 *
 * Cada prueba crea sus propias organizaciones con `create_organization()` y
 * sus propias cuentas: nada toca Geeko Store ni a otra prueba.
 */

const SUPER_ADMIN = { email: "superadmin@kamay.test", password: "kamay123" };
const PASSWORD = "kamay123";

/**
 * Cada prueba recorre la red varias veces (crear cuenta, crear organización,
 * entrar con dos sesiones): en CI eso pasa de los 5 s por omisión de Vitest.
 * El super admin entra una sola vez y el cliente de servicio se reutiliza —
 * cada uno de ellos consulta `supabase status` al construirse—.
 */
const TIMEOUT = 30_000;

let service: SupabaseClient;
let admin: SupabaseClient;
let superAdminId: string;

beforeAll(async () => {
  service = adminClient();
  admin = await signIn(SUPER_ADMIN);
  superAdminId = await userIdByEmail(service, SUPER_ADMIN.email);
}, TIMEOUT);

function suffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
}

async function newAccount(prefix: string): Promise<{ id: string; email: string }> {
  const email = `${prefix}-${suffix()}@kamay.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`cuenta: ${error.message}`);
  return { id: data.user.id, email };
}

async function newOrganization(name: string) {
  return new OrganizationAdminService(admin).create({
    name: `${name} ${suffix()}`,
    currency: "BOB",
    timezone: "America/La_Paz",
  });
}

describe("el super admin gestiona equipos", { timeout: TIMEOUT }, () => {
  it("agrega una cuenta existente como dueña y ella entra a trabajar", async () => {
    const organizationId = await newOrganization("Taller Integración");
    const account = await newAccount("int-duena");

    const outcomes = await new MembershipAdminService(admin).assign(account.id, [
      { organizationId, role: "owner", displayName: "Dueña Integración" },
    ]);
    expect(outcomes).toEqual([{ organizationId, status: "created" }]);

    // La dueña nueva ve su organización y es dueña de verdad: lee su bitácora.
    const owner = await signIn({ email: account.email, password: PASSWORD });
    const { data: isOwner } = await owner.rpc("is_owner", { org: organizationId });
    expect(isOwner).toBe(true);

    // Y el super admin la ve con su correo desde el detalle.
    const members = await new UserAdminService(admin).list({ organizationId });
    expect(members.map((m) => m.email)).toEqual([account.email]);
  });

  it("asigna dos organizaciones de una vez, con un rol en cada una", async () => {
    const [b, c] = await Promise.all([
      newOrganization("Taller B"),
      newOrganization("Taller C"),
    ]);
    const account = await newAccount("int-dos");

    const outcomes = await new MembershipAdminService(admin).assign(account.id, [
      { organizationId: b, role: "owner", displayName: "Ana" },
      { organizationId: c, role: "assistant", displayName: "Ana" },
    ]);
    expect(outcomes.map((o) => o.status)).toEqual(["created", "created"]);

    const user = (await new UserAdminService(admin).get(account.id))!;
    const roles = Object.fromEntries(user.memberships.map((m) => [m.organizationId, m.role]));
    expect(roles).toEqual({ [b]: "owner", [c]: "assistant" });

    // Repetir la asignación no duplica nada.
    const again = await new MembershipAdminService(admin).assign(account.id, [
      { organizationId: b, role: "owner", displayName: "Ana" },
    ]);
    expect(again).toEqual([{ organizationId: b, status: "already_member" }]);
  });

  it("no puede quitarle el acceso a la última dueña", async () => {
    const organizationId = await newOrganization("Taller Última");
    const account = await newAccount("int-ultima");
    await new MembershipAdminService(admin).assign(account.id, [
      { organizationId, role: "owner", displayName: "Única" },
    ]);

    const [membership] = (await new UserAdminService(admin).list({ organizationId }))[0]
      .memberships;

    await expect(
      new InvitationService(admin).archiveMembership(organizationId, membership.membershipId),
    ).rejects.toThrow(/al menos un dueño/);

    const [after] = (await new UserAdminService(admin).list({ organizationId }))[0].memberships;
    expect(after.archivedAt).toBeNull();
  });

  it("renombra una membresía y el cambio queda marcado en la bitácora", async () => {
    const organizationId = await newOrganization("Taller Nombre");
    const account = await newAccount("int-nombre");
    await new MembershipAdminService(admin).assign(account.id, [
      { organizationId, role: "owner", displayName: "Antes" },
    ]);
    const [membership] = (await new UserAdminService(admin).list({ organizationId }))[0]
      .memberships;

    await new MembershipAdminService(admin).setDisplayName(
      organizationId,
      membership.membershipId,
      "Después",
    );

    const owner = await signIn({ email: account.email, password: PASSWORD });
    const { data: events } = await owner
      .from("activity_log")
      .select("actor_label, changes")
      .eq("organization_id", organizationId)
      .eq("record_id", membership.membershipId)
      .eq("action", "updated");

    expect(events?.[0]?.actor_label).toBe(PLATFORM_ADMIN_LABEL);
    expect(events?.[0]?.changes).toMatchObject({
      display_name: { antes: "Antes", despues: "Después" },
    });
  });
});

describe("el super admin no forma parte del equipo", { timeout: TIMEOUT }, () => {
  it("no aparece en el equipo, no es asignable y no recibe avisos de talleres ajenos", async () => {
    const organizationId = await newOrganization("Taller Equipo");
    const account = await newAccount("int-equipo");
    await new MembershipAdminService(admin).assign(account.id, [
      { organizationId, role: "owner", displayName: "Dueña Equipo" },
    ]);
    // El super admin trabaja dentro: edita la organización.
    await new OrganizationAdminService(admin).update(organizationId, {
      name: `Taller Equipo editado ${suffix()}`,
      currency: "BOB",
      timezone: "America/La_Paz",
    });

    const owner = await signIn({ email: account.email, password: PASSWORD });

    // Escenario «Not listed among the members».
    const members = await new InvitationService(owner).listMembers(organizationId);
    expect(members.map((m) => m.userId)).toEqual([account.id]);

    // Escenario «Not assignable».
    const assignees = await new TaskService(owner).assignees(organizationId);
    expect(assignees.map((a) => a.userId)).not.toContain(superAdminId);

    // Escenario «No notifications from foreign organizations»: los
    // destinatarios salen de las membresías, como en el trabajo diario.
    const { data: recipients } = await service
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null);
    const userIds = (recipients ?? []).map((r) => r.user_id as string);
    expect(userIds).not.toContain(superAdminId);

    const plan = planScheduled({
      organizationId,
      today: "2026-09-14",
      localHour: DEFAULT_PREFERENCES.dailySummaryHour,
      tasks: [
        {
          id: "00000000-0000-4000-8000-0000000026a1",
          organizationId,
          title: "Revisar horno",
          dueDate: "2026-09-10",
          assigneeId: null,
          statusKind: "initial" as const,
          statusSince: null,
          closed: false,
        },
      ],
      members: userIds.map((userId) => ({ userId, preferences: { ...DEFAULT_PREFERENCES } })),
    });

    const before = await countNotifications(service, { userId: superAdminId });
    await new NotificationGenerator(service, new MemoryMailer(), "https://kamay.test").emit(
      plan.map((n) => ({ ...n, dedupeKey: `kam26:${suffix()}:${n.dedupeKey}` })),
    );
    expect(await countNotifications(service, { userId: superAdminId })).toBe(before);
  });
});
