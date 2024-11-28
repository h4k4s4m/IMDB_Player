let tmdbOptions = null;
let isInitialized = false;
let tokenCheckInterval = null;

async function initializeTmdbOptions() {
    const result = await chrome.storage.local.get(['tmdbToken']);
    if (!result.tmdbToken) {
        throw new Error('TMDB token not configured');
    }
    
    tmdbOptions = {
        headers: {
            'Authorization': `Bearer ${result.tmdbToken}`,
            'Content-Type': 'application/json'
        }
    };
}

console.log('Viewer.js loaded');

async function fetchShowInfo(imdbId) {
    console.log('Fetching show info for:', imdbId);
    try {
        const findResponse = await fetch(
            `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
            tmdbOptions
        );
        const findData = await findResponse.json();
        const tmdbId = findData.tv_results[0]?.id;
        
        const showResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}`,
            tmdbOptions
        );
        const showData = await showResponse.json();
        return { tmdbId, showData };
    } catch (error) {
        console.error('Error fetching show info:', error);
        throw error;
    }
}

function createEpisodeCard(episode, season, imdbId, episodeImage) {
    const card = document.createElement('div');
    card.className = 'episode-card';

    // Create image/placeholder
    if (episodeImage) {
        const img = document.createElement('img');
        img.src = episodeImage;
        img.className = 'episode-image';
        img.alt = `Episode ${episode.Episode}`;
        card.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'episode-image';
        placeholder.style.backgroundColor = '#444';
        card.appendChild(placeholder);
    }

    // Create title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'episode-title';
    titleDiv.textContent = `Episode ${episode.Episode}: ${episode.Title}`;
    card.appendChild(titleDiv);

    // Create info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'episode-info';
    infoDiv.textContent = `Released: ${episode.Released}`;
    
    const ratingDiv = document.createElement('div');
    ratingDiv.textContent = `Rating: ${episode.imdbRating}/10`;
    infoDiv.appendChild(ratingDiv);
    
    card.appendChild(infoDiv);

    // Add click handler
    card.addEventListener('click', async () => {
        document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const videoFrame = document.getElementById('video-frame');
        const episodeUrl = new URL('https://vidsrc.me/embed/tv');
        episodeUrl.searchParams.append('imdb', imdbId);
        episodeUrl.searchParams.append('season', season);
        episodeUrl.searchParams.append('episode', episode.Episode);
        videoFrame.src = episodeUrl.toString();

        // Save last played episode info
        chrome.storage.local.get(['watchHistory'], async function(result) {
            let history = result.watchHistory || [];
            const showIndex = history.findIndex(item => item.imdbID === imdbId);
            
            if (showIndex !== -1) {
                history[showIndex].lastEpisode = {
                    season: season,
                    episode: episode.Episode,
                    title: episode.Title,
                    tmdbId: history[showIndex].tmdbId
                };
                chrome.storage.local.set({ watchHistory: history });
            }
        });
    });

    return card;
}

async function getSeasonData(tmdbId, season) {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}`,
            tmdbOptions
        );
        const data = await response.json();
        console.log('TMDB season data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching TMDB season data:', error);
        return null;
    }
}

function updateEpisodeListHeight() {
    const episodeList = document.querySelector('.episode-list');
    const videoContainer = document.querySelector('.video-container');
    if (episodeList && videoContainer) {
        const videoHeight = videoContainer.offsetHeight;
        episodeList.style.height = `${videoHeight - 30}px`;
    }
}

async function loadSeason(imdbId, season, tmdbId) {
    const container = document.getElementById('episodes-container');
    const episodeList = document.querySelector('.episode-list');
    const videoContainer = document.querySelector('.video-container');
    container.innerHTML = '';

    try {
        // Get last played episode
        const result = await chrome.storage.local.get(['watchHistory']);
        const history = result.watchHistory || [];
        const showInfo = history.find(item => item.imdbID === imdbId);
        const lastEpisode = showInfo?.lastEpisode;

        // Get season data from TMDB
        const tmdbSeasonData = await getSeasonData(tmdbId, season);

        if (tmdbSeasonData && tmdbSeasonData.episodes) {
            for (const episode of tmdbSeasonData.episodes) {
                const episodeData = {
                    Episode: episode.episode_number,
                    Title: episode.name,
                    Released: episode.air_date,
                    imdbRating: (episode.vote_average || 'N/A').toString(),
                    still_path: episode.still_path
                };

                const card = createEpisodeCard(
                    episodeData,
                    season,
                    imdbId,
                    episodeData.still_path ? `https://image.tmdb.org/t/p/w300${episodeData.still_path}` : null
                );
                container.appendChild(card);
            }
        }

        // Update height after episodes are loaded
        updateEpisodeListHeight();

        // After creating all episode cards, select the last played episode
        if (lastEpisode && parseInt(lastEpisode.season) === parseInt(season)) {
            const episodeCards = container.querySelectorAll('.episode-card');
            const targetCard = Array.from(episodeCards)
                .find(card => card.querySelector('.episode-title')
                    .textContent.startsWith(`Episode ${lastEpisode.episode}:`));
            
            if (targetCard) {
                targetCard.click();
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            // If no last episode or different season, select first episode
            container.firstChild?.click();
        }
    } catch (error) {
        console.error('Error loading season:', error);
        const errorDiv = document.createElement('div');
        errorDiv.textContent = `Error loading season: ${error.message}`;
        errorDiv.style.color = '#ff4444';
        container.appendChild(errorDiv);
    }
}

async function initialize() {
    if (isInitialized) return;
    
    // Get all DOM elements first
    const loadingText = document.getElementById('loading-text');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const container = document.querySelector('.container');
    
    try {
        await initializeTmdbOptions();
        
        loadingText.textContent = 'Loading...';
        
        const params = new URLSearchParams(window.location.search);
        const imdbId = params.get('imdb');
        
        // Get show info and TMDB ID
        const showInfo = await fetchShowInfo(imdbId);
        if (!showInfo || !showInfo.tmdbId) throw new Error('Failed to load show information');
        
        const tmdbId = showInfo.tmdbId;
        console.log('TMDB ID:', tmdbId);

        // Get last played episode info
        const result = await chrome.storage.local.get(['watchHistory']);
        const history = result.watchHistory || [];
        const showHistory = history.find(item => item.imdbID === imdbId);
        const lastEpisode = showHistory?.lastEpisode;

        const totalSeasons = showInfo.showData.number_of_seasons;
        if (!totalSeasons) throw new Error('No season information available');

        // Hide loading and show container
        loading.style.display = 'none';
        container.style.display = 'flex';

        // Populate season selector
        const seasonSelect = document.getElementById('season-select');
        for (let i = 1; i <= totalSeasons; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Season ${i}`;
            seasonSelect.appendChild(option);
        }

        seasonSelect.addEventListener('change', (e) => {
            loadSeason(imdbId, e.target.value, tmdbId);
        });

        // Set initial season and load episodes
        if (lastEpisode) {
            seasonSelect.value = lastEpisode.season;
            await loadSeason(imdbId, lastEpisode.season, tmdbId);
        } else {
            await loadSeason(imdbId, 1, tmdbId);
        }
        
        isInitialized = true;
    } catch (err) {
        console.error('Initialization error:', err);
        loading.style.display = 'none';
        error.textContent = err.message;
        error.style.display = 'block';
        container.style.display = 'none';
        
        if (err.message === 'TMDB token not configured') {
            error.textContent = 'TMDB token not configured. Opening configuration page...';
            chrome.runtime.openOptionsPage();
            startTokenCheck();
        }
    }
}

function startTokenCheck() {
    if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
    }
    
    tokenCheckInterval = setInterval(async () => {
        const result = await chrome.storage.local.get(['tmdbToken']);
        if (result.tmdbToken) {
            clearInterval(tokenCheckInterval);
            window.location.reload();
        }
    }, 1000); // Check every second
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
    initialize();
}

// Remove any existing mutation observers
if (window.existingObserver) {
    window.existingObserver.disconnect();
}

// Add resize listener when the document loads
document.addEventListener('DOMContentLoaded', () => {
    // Add resize event listener
    window.addEventListener('resize', updateEpisodeListHeight);
}); 