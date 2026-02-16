import { Routes, Route, useParams } from "react-router-dom";
import { Home } from './pages/home';
import { Favorites } from "./pages/favorites";
import { HostAuthSystem } from "./pages/host-auth";
import GuestPage from "./pages/guest-page";
import { NavBar } from "./components/nav-bar";
import { MovieProvider } from "./contexts/movie-provider"
import './css/app.css'

// Helper to generate and store stable drop_time for testing
// In production, drop_time comes from database (set by host)
const getDropTimeForEvent = (eventId: string): string => {
  const storageKey = `potluck_drop_time_${eventId}`;

  // Check if we already generated a drop time for this event
  const storedDropTime = localStorage.getItem(storageKey);
  if (storedDropTime) {
    return storedDropTime;
  }

  // Generate a new drop time (2-4 hours from now)
  const eventIdHash = eventId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const now = Date.now();
  const baseTime = now + 3 * 60 * 60 * 1000; // 3 hours from now
  const offset = (eventIdHash % 120) * 60 * 1000; // 0-119 minutes offset
  const dropTime = new Date(baseTime + offset).toISOString();

  // Store it so it's consistent across reloads
  localStorage.setItem(storageKey, dropTime);
  return dropTime;
};

// Mock event data - replace with actual API call in production
const getMockEventData = (eventId: string) => {
  const dropTime = getDropTimeForEvent(eventId);
  console.log("Event:", eventId, "- Drop time:", dropTime, "(For debugging, remove in production)");

  return {
    title: "Summer BBQ Potluck",
    date: new Date(Date.now()).toISOString().split('T')[0], // Tomorrow
    location: "Miller's Backyard",
    drop_time: dropTime,
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
};

function GuestPageWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  // TODO: Fetch event data from API using eventId
  // For now, use mock data with event-specific drop_time
  const eventData = getMockEventData(eventId || 'default');
  return <GuestPage eventData={eventData} eventId={eventId || ''} />;
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
