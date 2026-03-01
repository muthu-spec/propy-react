import { createContext, useContext } from "react";

export interface MovieContextType {
    favorites: Movie[];
    addToFavorites: (movie: Movie) => void;
    removeFromFavorites: (movieId: Movie["id"]) => void;
    isFavorite: (movieId: Movie["id"]) => boolean;
}

export interface Movie { 
    id: number,
    title: string,
    release_date: string
    poster_path: string
};
export const movieContext = createContext<MovieContextType | undefined>(undefined);

export const useMovieContext = () => {
    const context = useContext(movieContext);
    if (!context) throw new Error("useMovieContext must be used within a MovieProvider");
    return context
}