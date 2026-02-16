
import { Routes, Route, useParams } from "react-router-dom";
import { Home } from './pages/home';
import { Favorites } from "./pages/favorites";
import { HostAuthSystem } from "./pages/host-auth";
import GuestPage from "./pages/guest-page";
import { NavBar } from "./components/nav-bar";
import { MovieProvider } from "./contexts/movie-provider"
import './css/app.css'


// Mock event data - replace with actual API call in production
const mockEventData = {
  title: "Summer BBQ Potluck",
  date: "2025-07-15",
  location: "Miller's Backyard",
  drop_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
  menu: [
    { id: "1", label: "Grilled Burgers" },
    { id: "2", label: "Potato Salad" },
    { id: "3", label: "Corn on the Cob" },
    { id: "4", label: "Watermelon" },
    { id: "5", label: "BBQ Sauce" },
    { id: "6", label: "Buns" },
    { id: "7", label: "Chips & Dip" },
    { id: "8", label: "Ice Cream" },
  ]
};

function GuestPageWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  // TODO: Fetch event data from API using eventId
  // For now, use mock data
  return <GuestPage eventData={mockEventData} eventId={eventId || ''} />;
}

function App() {

  return (
  
    <MovieProvider> 
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/login" element={<HostAuthSystem />} />
          <Route path="/join/:eventId" element={<GuestPageWrapper />} />
        </Routes>
      </main>
    </MovieProvider>
  
  )
}

export default App
