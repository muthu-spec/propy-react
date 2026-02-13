import '../css/favorites.css'
import { useMovieContext, type Movie } from '../contexts/movie-context'
import { MovieCard } from '../components/movie-card'

export function Favorites() {
    const { favorites } = useMovieContext()
    if (favorites) {
       return (
           <div className = "favorites" >
                <h2>Your Favorites</h2>
                <div className="movie-grid">
                    {favorites.map(
                    (movie: Movie)=> (
                    <MovieCard movie={movie} key={movie.id}/>
                    ))}
                </div>
            </div>
       )
    } else {
    return (
        <div className='favorites-empty'>
            <h2>No favorites yet</h2>
            <p>Start adding movies to your favorites and they will appear here</p>
        </div>
    )
    }
}