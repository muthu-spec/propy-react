import { useState, useEffect } from "react";
import { MovieCard } from "../components/movie-card";
import '../css/home.css'
import { getPopularMovies, searchMovies } from "../services/api";

interface Movie {
    title: string,
    id: number,
    release_date: string,
    poster_path: string;

}
export function Home() {
    const [searchQuery, setSearchQuery] = useState('')
    const [movies, setMovies] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(()=>{
      const loadPopularMovies = async() => {
       
       setLoading(true)
       try {
        const populareMovies =  await getPopularMovies()
        setMovies(populareMovies)
       }
       catch (err) {
        console.log(err)
        setError('Failed to load movies...')
       } 
       finally {
        setLoading(false)
       }
    } 
      loadPopularMovies()
    },[])
    // const movies = [
    //     {id: 1, title: "movie1", release_date: "09-12"},
    //     {id: 2, title: "movie2", release_date: "10-12"},
    //     {id: 3, title: "movie3", release_date: "11-12"}
    // ]
    const handleSearch = async(e: { preventDefault: () => void; }) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        if (loading) return

        setLoading(true)

        try {
            const filterMovies = await searchMovies(searchQuery)
            setMovies(filterMovies)
        }
        catch (err) {
            console.log(err)
            setError('Failed to search movies...')
        }
        finally {
            setLoading(false)
        }
    }
    return(
        <div className="home">
            <form className="search-form" onSubmit={handleSearch}>
                <input className="search-input" type="text" placeholder="Search for movies" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                <button className="search-button" type='submit'> Search </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {loading ? (<div className="loading">Loading...</div>) : 
            <div className="movie-grid">
                {movies.map(
                (movie: Movie)=> (
                movie.title.toLowerCase().startsWith(searchQuery) &&
                <MovieCard movie={movie} key={movie.id}/>
                ))}
            </div>
            }
        </div>
            
            

    )
}