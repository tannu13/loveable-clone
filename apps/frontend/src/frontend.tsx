import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bootstrapSession } from "./lib/session";

const elem = document.getElementById("root")!;
const queryClient = new QueryClient();

await bootstrapSession();

createRoot(elem).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
