import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import KnowledgeBase from "../app/knowledge-base";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root");
}

createRoot(root).render(
  <StrictMode>
    <KnowledgeBase />
  </StrictMode>,
);
