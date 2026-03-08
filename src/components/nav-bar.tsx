import { Link } from "react-router-dom";
import '../css/nav-bar.css'

export function NavBar() {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Movie app</Link>
            </div>
            <div className="navbar-links">
                <Link to="/" className='nav-link'>Home</Link>
                <Link to="/favorites" className='nav-link'>Favorites</Link>
                <Link to="/login" className='nav-link'>Login</Link>
                <Link to="/dashboard" className='nav-link'>Dashboard</Link>
            </div>
        </nav>
    )
}