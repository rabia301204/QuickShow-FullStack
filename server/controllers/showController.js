import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

const TMDB_BASE_URL = 'https://tmbd-proxy.rabiadabra.workers.dev';

export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get(`${TMDB_BASE_URL}/3/movie/now_playing`)
        res.json({ success: true, movies: data.results })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

export const addShow = async (req, res) => {
    try {
        const { movieId, showsInput, showPrice } = req.body
        let movie = await Movie.findById(movieId)

        if (!movie) {
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`${TMDB_BASE_URL}/3/movie/${movieId}`),
                axios.get(`${TMDB_BASE_URL}/3/movie/${movieId}/credits`)
            ]);

            movie = await Movie.create({
                _id: movieId,
                title: movieDetailsResponse.data.title,
                overview: movieDetailsResponse.data.overview,
                poster_path: movieDetailsResponse.data.poster_path,
                backdrop_path: movieDetailsResponse.data.backdrop_path,
                genres: movieDetailsResponse.data.genres,
                casts: movieCreditsResponse.data.cast,
                release_date: movieDetailsResponse.data.release_date,
                original_language: movieDetailsResponse.data.original_language,
                tagline: movieDetailsResponse.data.tagline || "",
                vote_average: movieDetailsResponse.data.vote_average,
                runtime: movieDetailsResponse.data.runtime,
            });
        }

        const showsToCreate = [];
        showsInput.forEach(show => {
            show.time.forEach((time) => {
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(`${show.date}T${time}`),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });

        if (showsToCreate.length > 0) await Show.insertMany(showsToCreate);

        await inngest.send({ name: "app/show.added", data: { movieTitle: movie.title } })
        res.json({ success: true, message: 'Show Added successfully.' })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie').sort({ showDateTime: 1 });
        const uniqueShows = new Set(shows.map(show => show.movie))
        res.json({ success: true, shows: Array.from(uniqueShows) })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;
        const shows = await Show.find({ movie: movieId, showDateTime: { $gte: new Date() } })
        const movie = await Movie.findById(movieId);
        const dateTime = {};
        shows.forEach((show) => {
            const date = show.showDateTime.toISOString().split("T")[0];
            if (!dateTime[date]) dateTime[date] = []
            dateTime[date].push({ time: show.showDateTime, showId: show._id })
        })
        res.json({ success: true, movie, dateTime })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}