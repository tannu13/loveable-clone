import { Route, Routes } from "react-router-dom";
import { WorkspaceRoute } from "./pages/WorkspaceRoute";

export function App() {
  return (
    <Routes>
      <Route element={<WorkspaceRoute />} path="/" />
      <Route element={<WorkspaceRoute />} path="/:conversationId" />
    </Routes>
  );
}

export default App;
