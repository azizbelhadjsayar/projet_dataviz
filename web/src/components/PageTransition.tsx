import { ViewTransition, type ReactNode } from "react";

// Fondu discret à l'arrivée d'une page (navigation). Aucune animation lors des mises à jour
// sur place (changement de filtre) : default="none". Désactivé si « mouvement réduit » (CSS).
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-fade" exit="page-fade" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
