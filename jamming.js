// jamming.js
let socket;
let sessionId;
let currentMovie;
let matches = [];
let isConnected = false;

// Initialize WebSocket connection
function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8080');
    
    socket.onopen = () => {
        console.log('Connected to WebSocket server');
        isConnected = true;
        enableJammingControls();
    };
    
    socket.onmessage = (event) => {
        handleWebSocketMessage(JSON.parse(event.data));
    };
    
    socket.onclose = () => {
        console.log('Disconnected from WebSocket server');
        isConnected = false;
        disableJammingControls();
        showReconnectButton();
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showErrorMessage('Connection error. Please try again.');
    };
}

// Enable/disable controls based on connection status
function enableJammingControls() {
    document.getElementById('create-session').disabled = false;
    document.getElementById('join-session').disabled = false;
    document.querySelector('.error-message')?.remove();
}

function disableJammingControls() {
    document.getElementById('create-session').disabled = true;
    document.getElementById('join-session').disabled = true;
}

function showReconnectButton() {
    const reconnectBtn = document.createElement('button');
    reconnectBtn.textContent = 'Reconnect';
    reconnectBtn.classList.add('jam-button');
    reconnectBtn.onclick = initializeWebSocket;
    document.querySelector('.jamming-container').prepend(reconnectBtn);
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.style.color = '#ef4444';
    errorDiv.style.marginBottom = '1rem';
    errorDiv.textContent = message;
    document.querySelector('.jamming-container').prepend(errorDiv);
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(message) {
    switch(message.type) {
        case 'session_created':
            handleSessionCreated(message.sessionId);
            break;
        case 'partner_joined':
            handlePartnerJoined();
            break;
        case 'new_movie':
            displayJammingMovie(message.movie);
            break;
        case 'match':
            handleMatch(message.movie);
            break;
        case 'partner_left':
            handlePartnerLeft();
            break;
    }
}

// Create a new jamming session
document.getElementById('create-session').addEventListener('click', () => {
    if (!isConnected) {
        showErrorMessage('Not connected to server. Please wait or refresh the page.');
        return;
    }
    
    socket.send(JSON.stringify({
        type: 'create_session'
    }));
});

// Join an existing session
document.getElementById('join-session').addEventListener('click', () => {
    if (!isConnected) {
        showErrorMessage('Not connected to server. Please wait or refresh the page.');
        return;
    }
    
    const sessionIdInput = document.getElementById('session-id').value.trim();
    if (!sessionIdInput) {
        showErrorMessage('Please enter a session ID');
        return;
    }
    
    socket.send(JSON.stringify({
        type: 'join_session',
        sessionId: sessionIdInput
    }));
});

// Handle session creation response
function handleSessionCreated(newSessionId) {
    sessionId = newSessionId;
    document.getElementById('current-session-id').textContent = sessionId;
    document.getElementById('session-controls').classList.add('hidden');
    document.getElementById('active-session').classList.remove('hidden');
    
    // Create shareable link
    const shareLink = document.createElement('p');
    shareLink.innerHTML = `Share this ID with your friend: <strong>${sessionId}</strong>`;
    shareLink.classList.add('share-link');
    document.querySelector('.session-info').prepend(shareLink);
}

// Handle partner joining the session
function handlePartnerJoined() {
    document.getElementById('partner-status').textContent = '✅ Partner connected!';
    document.getElementById('jamming-movie').classList.remove('hidden');
}

// Display movie for jamming
function displayJammingMovie(movie) {
    currentMovie = movie;
    const posterUrl = movie.Poster !== 'N/A' ? movie.Poster : '/api/placeholder/300/450';
    
    document.getElementById('current-movie-poster').src = posterUrl;
    document.getElementById('current-movie-title').textContent = movie.Title;
    document.getElementById('current-movie-year').textContent = movie.Year;
    
    // Enable swipe buttons
    document.getElementById('swipe-left').disabled = false;
    document.getElementById('swipe-right').disabled = false;
}

// Handle swipe actions
document.getElementById('swipe-left').addEventListener('click', () => {
    handleSwipe('left');
});

document.getElementById('swipe-right').addEventListener('click', () => {
    handleSwipe('right');
});

function handleSwipe(direction) {
    if (!currentMovie) return;
    
    // Disable buttons until next movie
    document.getElementById('swipe-left').disabled = true;
    document.getElementById('swipe-right').disabled = true;
    
    socket.send(JSON.stringify({
        type: 'swipe',
        sessionId: sessionId,
        movieId: currentMovie.imdbID,
        direction: direction
    }));
}

// Handle movie matches
function handleMatch(movie) {
    matches.push(movie);
    
    const matchNotification = document.getElementById('match-notification');
    document.getElementById('matched-movie').textContent = movie.Title;
    matchNotification.classList.remove('hidden');
    
    // Add match to matches list
    const matchesList = document.getElementById('matches-list') || createMatchesList();
    const matchItem = document.createElement('div');
    matchItem.classList.add('match-item');
    matchItem.innerHTML = `
        <img src="${movie.Poster}" alt="${movie.Title}" width="50">
        <span>${movie.Title} (${movie.Year})</span>
    `;
    matchesList.appendChild(matchItem);
    
    // Hide notification after delay
    setTimeout(() => {
        matchNotification.classList.add('hidden');
    }, 3000);
}

// Create matches list if it doesn't exist
function createMatchesList() {
    const matchesList = document.createElement('div');
    matchesList.id = 'matches-list';
    matchesList.classList.add('matches-list');
    
    const heading = document.createElement('h3');
    heading.textContent = 'Your Matches';
    
    const container = document.createElement('div');
    container.classList.add('matches-container');
    container.appendChild(heading);
    container.appendChild(matchesList);
    
    document.querySelector('.jamming-container').appendChild(container);
    return matchesList;
}

// Handle partner leaving
function handlePartnerLeft() {
    document.getElementById('partner-status').textContent = '❌ Partner disconnected';
    document.getElementById('jamming-movie').classList.add('hidden');
    showErrorMessage('Your partner has disconnected. Please start a new session.');
}

// Initialize WebSocket when page loads
initializeWebSocket();