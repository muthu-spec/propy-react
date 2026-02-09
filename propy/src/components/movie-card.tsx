import '../css/movie-card.css'
import { useMovieContext } from '../contexts/movie-context'

interface MovieCardProps {
    movie: { 
        id: number,
        title: string,
        release_date: string
        poster_path: string
    };
  }


export function MovieCard({movie}:MovieCardProps)  {
  const { isFavorite, addToFavorites, removeFromFavorites } = useMovieContext()
  const favorite = isFavorite(movie.id)


  function onFavoriteClick(e: { preventDefault: () => void }) {
      e.preventDefault()
      if (favorite) removeFromFavorites(movie.id)
      else addToFavorites(movie)
  }
  return (
      <div className="movie-card">
        <div className="movie-poster">
          <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title}/>
          <div className="movie-overlay">
              <button className={`favorite-btn ${favorite ? 'active': ''}`} onClick={onFavoriteClick}>
                ♥
              </button>
          </div>
        </div>
        <div className="movie-info">
          <h3>{movie.title}</h3>
          <p>{movie.release_date?.split('-')[0]}</p>
        </div>
      </div>
  )

}