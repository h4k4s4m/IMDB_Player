const OMDB_API_KEY = '88b298f3';

async function fetchMovieDetails(imdbId) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

function createItemElement(item, isFavorite = false) {
    const div = document.createElement('div');
    div.className = isFavorite ? 'favorite-item' : 'history-item';
    div.innerHTML = `
        <img class="poster" src="${item.Poster !== 'N/A' ? item.Poster : 'placeholder.png'}" alt="${item.Title}">
        <div class="item-details">
            <div class="title">${item.Title}</div>
            <div class="metadata">${item.Year} • ${item.Type}</div>
        </div>
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-imdb="${item.imdbID}">
            &#9733;
        </button>
    `;

    // Watch button
    const watchBtn = document.createElement('button');
    watchBtn.className = 'watch-btn';
    watchBtn.innerHTML = '&#9654;'; // Play triangle
    watchBtn.style.cssText = `
        background: none;
        border: none;
        color: #f5c518;
        cursor: pointer;
        font-size: 1.2em;
        padding: 3px;
        margin-right: 5px;
    `;
    
    div.querySelector('.item-details').appendChild(watchBtn);

    // Watch button click
    watchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.Type === 'series') {
            const viewerURL = chrome.runtime.getURL('viewer.html');
            chrome.tabs.create({ url: `${viewerURL}?imdb=${item.imdbID}` });
        } else {
            chrome.tabs.create({ url: `https://vidsrc.me/embed/movie?imdb=${item.imdbID}` });
        }
    });

    // Favorite button click
    const favoriteBtn = div.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item);
    });

    return div;
}

function toggleFavorite(item) {
    chrome.storage.local.get(['favorites'], function(result) {
        let favorites = result.favorites || [];
        const index = favorites.findIndex(f => f.imdbID === item.imdbID);
        
        if (index === -1) {
            favorites.push(item);
        } else {
            favorites.splice(index, 1);
        }
        
        chrome.storage.local.set({ favorites: favorites }, function() {
            updateLists();
        });
    });
}

function updateLists() {
    const historyList = document.getElementById('history-list');
    const favoritesList = document.getElementById('favorites-list');
    
    chrome.storage.local.get(['watchHistory', 'favorites'], function(result) {
        const history = result.watchHistory || [];
        const favorites = result.favorites || [];

        // Update history
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No watch history yet</div>';
        } else {
            history.forEach(item => {
                const isFavorite = favorites.some(f => f.imdbID === item.imdbID);
                historyList.appendChild(createItemElement(item, isFavorite));
            });
        }

        // Update favorites
        favoritesList.innerHTML = '';
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<div class="empty-state">No favorites yet</div>';
        } else {
            favorites.forEach(item => {
                favoritesList.appendChild(createItemElement(item, true));
            });
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateLists();
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
            
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            document.getElementById(tabName).style.display = 'block';
        });
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}); 