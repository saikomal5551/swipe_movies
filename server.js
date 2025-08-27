// server.js
const WebSocket = require('ws');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });

// Store active sessions
const sessions = new Map();

// Store user preferences and matches
const sessionPreferences = new Map();

const OMDB_API_KEY = '4272569c'; // Replace with your API key

// Function to fetch random popular movies
async function getRandomMovie() {
    // List of popular movie IDs to choose from
    const popularMovieIds = [
        'tt0111161', 'tt0068646', 'tt0071562', 'tt0468569', 
        'tt0050083', 'tt0108052', 'tt0167260', 'tt0110912'
    ];
    
    const randomId = popularMovieIds[Math.floor(Math.random() * popularMovieIds.length)];
    const response = await fetch(`http://www.omdbapi.com/?i=${randomId}&apikey=${OMDB_API_KEY}`);
    return await response.json();
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'create_session':
                const sessionId = uuidv4();
                sessions.set(sessionId, [ws]);
                sessionPreferences.set(sessionId, { likes: new Map(), matches: [] });
                ws.sessionId = sessionId;
                ws.send(JSON.stringify({
                    type: 'session_created',
                    sessionId
                }));
                break;

            case 'join_session':
                const session = sessions.get(data.sessionId);
                if (session && session.length < 2) {
                    session.push(ws);
                    ws.sessionId = data.sessionId;
                    
                    // Notify both users that partner joined
                    session.forEach(client => {
                        client.send(JSON.stringify({
                            type: 'partner_joined'
                        }));
                    });

                    // Send first movie
                    const movie = await getRandomMovie();
                    session.forEach(client => {
                        client.send(JSON.stringify({
                            type: 'new_movie',
                            movie
                        }));
                    });
                }
                break;

            case 'swipe':
                const currentSession = sessions.get(data.sessionId);
                const preferences = sessionPreferences.get(data.sessionId);
                
                if (!preferences.likes.has(data.movieId)) {
                    preferences.likes.set(data.movieId, new Set());
                }
                
                if (data.direction === 'right') {
                    preferences.likes.get(data.movieId).add(ws);
                    
                    // Check if both users liked the movie
                    if (preferences.likes.get(data.movieId).size === 2) {
                        const matchedMovie = await fetch(`http://www.omdbapi.com/?i=${data.movieId}&apikey=${OMDB_API_KEY}`)
                            .then(res => res.json());
                        
                        preferences.matches.push(matchedMovie);
                        currentSession.forEach(client => {
                            client.send(JSON.stringify({
                                type: 'match',
                                movie: matchedMovie
                            }));
                        });
                    }
                }

                // Send next movie
                const nextMovie = await getRandomMovie();
                currentSession.forEach(client => {
                    client.send(JSON.stringify({
                        type: 'new_movie',
                        movie: nextMovie
                    }));
                });
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws.sessionId) {
            const session = sessions.get(ws.sessionId);
            if (session) {
                // Notify other user that partner left
                session.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'partner_left'
                        }));
                    }
                });
                sessions.delete(ws.sessionId);
                sessionPreferences.delete(ws.sessionId);
            }
        }
    });
});

console.log('WebSocket server running on port 8080');