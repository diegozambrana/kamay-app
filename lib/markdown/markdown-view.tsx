import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import { taskBodySchema } from "./sanitize";

/**
 * Tipografía del cuerpo rendido, con utilidades explícitas.
 *
 * El proyecto no tiene `@tailwindcss/typography` y este cambio no lo añade:
 * la propuesta declara tres dependencias nuevas y ninguna es un plugin de
 * estilos. Son media docena de elementos; la lista cabe aquí.
 */
const MARKDOWN_TYPOGRAPHY = [
  "max-w-none text-sm break-words",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_p]:my-2 [&_p]:leading-relaxed",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  // Una lista de verificación no lleva viñeta: la casilla ya es la marca.
  "[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0",
  "[&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-muted-foreground/30 [&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
  "[&_hr]:border-border [&_hr]:my-4",
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-left",
  "[&_th]:border-border [&_th]:border-b [&_th]:pr-3 [&_th]:pb-1 [&_th]:font-medium",
  "[&_td]:border-border/50 [&_td]:border-b [&_td]:py-1 [&_td]:pr-3",
].join(" ");

/**
 * El **único** componente que rinde Markdown en la aplicación (design D1).
 *
 * El requisito no se cumple con "se sanea en la vista previa": se cumple si no
 * existe manera de rendir un cuerpo sin sanear. Por eso los plugins van
 * cableados aquí dentro y no se admite un `remarkPlugins` ni un
 * `rehypePlugins` desde fuera: quien quiera rendir Markdown pasa por aquí y
 * hereda el saneado, o no rinde Markdown.
 *
 * `components` sí se admite, porque sustituir cómo se pinta un elemento ya
 * saneado —una casilla marcable, por ejemplo— no puede reintroducir lo que el
 * saneado quitó.
 */
export function MarkdownView({
  children,
  className,
  components,
}: {
  children: string;
  className?: string;
  components?: Components;
}) {
  return (
    <div className={cn(MARKDOWN_TYPOGRAPHY, className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, taskBodySchema]]}
        components={components}
      >
        {children}
      </Markdown>
    </div>
  );
}
