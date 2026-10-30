import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { ForecastVsActualPage } from "./pages/ForecastVsActualPage";
import { AccuracyPage } from "./pages/AccuracyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="forecasts" element={<ForecastVsActualPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
