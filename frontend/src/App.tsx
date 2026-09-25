import { BrowserRouter, Routes, Route } from "react-router-dom";
import EngineTwinLanding from "./EngineTwinLanding";
import AnalysisPage from "./AnalysisPage";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<EngineTwinLanding />} />
                <Route path="/analysis" element={<AnalysisPage />} />
            </Routes>
        </BrowserRouter>
    );
}