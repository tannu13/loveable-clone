import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const elem = document.getElementById("root")!;

createRoot(elem).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
