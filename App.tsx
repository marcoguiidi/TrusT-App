import { AuthProvider } from "./context/AuthContext";
import { App } from "./app/index";

export default function AppEntry() {
  <AuthProvider>
    <App></App>
  </AuthProvider>;
}
