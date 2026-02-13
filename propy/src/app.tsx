
import { Routes, Route } from "react-router-dom";
import { Home } from './pages/home';
import { Favorites } from "./pages/favorites";
import { HostAuthSystem } from "./pages/host-auth";
import { NavBar } from "./components/nav-bar";
import { MovieProvider } from "./contexts/movie-provider"
import './css/app.css'


function App() {

  return (
  
    <MovieProvider> 
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/login" element={<HostAuthSystem />} />
        </Routes>
      </main>
    </MovieProvider>
  
  )
}

export default App
