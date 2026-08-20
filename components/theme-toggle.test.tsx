import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  it("cambia el tema al hacer clic", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = await screen.findByRole("button", { name: "Cambiar tema" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
