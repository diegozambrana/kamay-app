import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/profile", () => ({
  changePassword: vi.fn(async () => undefined),
}));

const { changePassword } = await import("@/actions/profile");
const { ChangePasswordDialog } = await import("./change-password-dialog");

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

async function openDialog() {
  const user = userEvent.setup();
  render(<ChangePasswordDialog />);
  await user.click(screen.getByTestId("open-change-password"));
  return user;
}

describe("ChangePasswordDialog", () => {
  it("abre el modal con los tres campos", async () => {
    await openDialog();

    expect(screen.getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar nueva contraseña")).toBeInTheDocument();
  });

  it("rechaza una nueva contraseña demasiado corta sin llamar al servidor", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja123");
    await user.type(screen.getByLabelText("Nueva contraseña"), "abc");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "abc");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(screen.getByText(/al menos 6 caracteres/)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("rechaza cuando la confirmación no coincide con la nueva", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja123");
    await user.type(screen.getByLabelText("Nueva contraseña"), "nueva123");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "otra123");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("con datos válidos llama a changePassword y cierra el modal", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja123");
    await user.type(screen.getByLabelText("Nueva contraseña"), "nueva123");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "nueva123");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "vieja123",
      newPassword: "nueva123",
    });
    expect(screen.queryByTestId("change-password-dialog")).not.toBeInTheDocument();
  });

  // El error del servidor —contraseña actual incorrecta— no cierra el modal.
  it("muestra el error del servidor sin cerrar el modal", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({
      error: "La contraseña actual no es correcta.",
    });
    const user = await openDialog();

    await user.type(screen.getByLabelText("Contraseña actual"), "mala123");
    await user.type(screen.getByLabelText("Nueva contraseña"), "nueva123");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "nueva123");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      screen.getByText("La contraseña actual no es correcta."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("change-password-dialog")).toBeInTheDocument();
  });
});
