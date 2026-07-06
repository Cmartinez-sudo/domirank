/**
 * Unit tests para groupInvitationEmail (Fase C+D #6).
 *
 * Verifica el shape del template + escaping de inputs no confiables
 * + fallback de avatar (iniciales si no hay avatar_url).
 */

import { describe, it, expect } from "vitest";
import { groupInvitationEmail } from "../email-templates";

const BASE_INPUT = {
  inviterUsername: "cmartinez",
  inviterDisplayName: "Carlos Martínez",
  inviterAvatarUrl: "https://cdn.example.com/avatar.png",
  groupName: "Los Jueves",
  groupDescription: "Crew que juega los jueves después del trabajo.",
  activeMembersCount: 6,
};

describe("groupInvitationEmail", () => {
  it("retorna shape { subject, html, text }", () => {
    const r = groupInvitationEmail(BASE_INPUT);
    expect(typeof r.subject).toBe("string");
    expect(typeof r.html).toBe("string");
    expect(typeof r.text).toBe("string");
  });

  it("el subject menciona al invitador y al grupo", () => {
    const r = groupInvitationEmail(BASE_INPUT);
    expect(r.subject).toContain("Carlos Martínez");
    expect(r.subject).toContain("Los Jueves");
  });

  it("el subject usa display_name si está; sino username", () => {
    const r1 = groupInvitationEmail({ ...BASE_INPUT, inviterDisplayName: null });
    expect(r1.subject).toContain("cmartinez");

    const r2 = groupInvitationEmail({ ...BASE_INPUT, inviterDisplayName: "Carlos M." });
    expect(r2.subject).toContain("Carlos M.");
  });

  it("incluye avatar tag <img> cuando hay avatar_url", () => {
    const r = groupInvitationEmail(BASE_INPUT);
    expect(r.html).toContain('<img src="https://cdn.example.com/avatar.png"');
  });

  it("fallback a iniciales cuando no hay avatar_url", () => {
    const r = groupInvitationEmail({ ...BASE_INPUT, inviterAvatarUrl: null });
    // El template shell tiene un <img> para el logo; no debe haber un <img>
    // del avatar (que tendría 64x64).
    expect(r.html).not.toContain('width="64" height="64"');
    // La inicial 'C' aparece como div de fallback.
    expect(r.html).toMatch(/<div[^>]*>C<\/div>/);
  });

  it("incluye descripción del grupo si está presente", () => {
    const r = groupInvitationEmail(BASE_INPUT);
    expect(r.html).toContain("Crew que juega los jueves");
  });

  it("omite descripción si es null", () => {
    const r = groupInvitationEmail({ ...BASE_INPUT, groupDescription: null });
    // No debería tener el blockquote vacío con la copia del placeholder.
    expect(r.html).not.toMatch(/font-style:italic[^>]*>&ldquo;/);
  });

  it("pluraliza miembros correctamente", () => {
    const single = groupInvitationEmail({ ...BASE_INPUT, activeMembersCount: 1 });
    expect(single.html).toContain("1 miembro activos");

    const plural = groupInvitationEmail({ ...BASE_INPUT, activeMembersCount: 6 });
    expect(plural.html).toContain("6 miembros activos");
  });

  it("el text fallback contiene la URL de /groups", () => {
    const r = groupInvitationEmail(BASE_INPUT);
    expect(r.text).toContain("/groups");
  });

  it("escapa HTML en displayName del invitador (defensa XSS)", () => {
    const malicious = "<script>alert('xss')</script>Bob";
    const r = groupInvitationEmail({
      ...BASE_INPUT,
      inviterDisplayName: malicious,
      inviterAvatarUrl: null, // forzar fallback de iniciales
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("escapa HTML en groupName", () => {
    const r = groupInvitationEmail({
      ...BASE_INPUT,
      groupName: "<b>Hack</b>",
    });
    expect(r.html).not.toContain("<b>Hack</b>");
    expect(r.html).toContain("&lt;b&gt;Hack&lt;/b&gt;");
  });

  it("escapa HTML en groupDescription", () => {
    const r = groupInvitationEmail({
      ...BASE_INPUT,
      groupDescription: '<img src=x onerror=alert(1)>',
    });
    expect(r.html).not.toMatch(/<img src=x/);
  });
});
