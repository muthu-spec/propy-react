import { useState, useEffect, type ReactNode } from "react";
import { movieContext, type Movie } from "./movie-context.tsx";

export const MovieProvider = ({children}: { children: ReactNode }) => {

    const [favorites, setFavorites] = useState<Movie[]>(() => {
        const storedFavs = localStorage.getItem("favorites");
        // If there's data, parse and return it; otherwise, return empty array
        return storedFavs ? JSON.parse(storedFavs) : [];
    })

    // useEffect(() => {
    //    const storedFavs = localStorage.getItem('favorites')
    //    if (storedFavs) setFavorites(JSON.parse(storedFavs))
    // }, [])
    
    useEffect(() => {
       localStorage.setItem('favorites', JSON.stringify(favorites))
    }, [favorites])

    const addToFavorites = (movie: Movie) => {
        setFavorites(prev => [...prev, movie])
    }

    const removeFromFavorites = (movieId: Movie['id']) => {
        setFavorites(prev => prev.filter(movie => movie.id !== movieId))
    }
    
    const isFavorite = (movieId: Movie['id']) => {
        return favorites.some(movie => movie.id === movieId)
    }

    const value = {
        favorites,
        addToFavorites,
        removeFromFavorites,
        isFavorite
    }

    return <movieContext.Provider value={value}>
        {children}
    </movieContext.Provider>
}