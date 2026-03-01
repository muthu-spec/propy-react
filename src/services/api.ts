const API_KEY='790153164764802916e71e7871713677'
const BASE_URL='https://api.themoviedb.org/3'

export const getPopularMovies = async () => {
    const response = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`)
    const data  = await response.json()
    console.log(data.results)
    return data.results
}

export const searchMovies = async(query: string | number | boolean) => {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`)
    const data = await response.json()
    return data.results
 
}