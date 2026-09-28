"use client";

import dynamic from "next/dynamic";
import { AgentAvatar } from "./icons";

// L'agent dépend de l'état du navigateur (conversation de l'onglet, préférences de mouvement) :
// rendu côté client uniquement, sans décalage d'hydratation.
export const AgentChatClient = dynamic(() => import("./AgentChat"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center">
      <span className="animate-pulse"><AgentAvatar size={40} /></span>
    </div>
  ),
});
