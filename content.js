function addWatchButton() {
    // Check if we're on a title page
    if (!window.location.pathname.startsWith('/title/')) return;

    // Check if button already exists
    if (document.querySelector('#watch-now-container')) return;

    // Get IMDB ID from URL
    const imdbId = window.location.pathname.split('/')[2];
    
    // Check if it's a TV show
    const isTvShow = Array.from(document.getElementsByTagName('span'))
        .some(span => span.textContent === 'Episodes');

    // Create container
    const container = document.createElement('div');
    container.id = 'watch-now-container';
    container.style.cssText = `
        display: inline-block;
        margin-left: 15px;
        vertical-align: middle;
    `;

    // Create watch button
    const watchButton = document.createElement('button');
    watchButton.innerHTML = 'Watch Now';
    watchButton.style.cssText = `
        background-color: #f5c518;
        border: none;
        color: black;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
    `;

    watchButton.addEventListener('click', async () => {
        try {
            // Get movie/show details
            const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=88b298f3`);
            const details = await response.json();
            
            // Save to watch history using Chrome storage
            chrome.storage.local.get(['watchHistory'], function(result) {
                let history = result.watchHistory || [];
                const existingIndex = history.findIndex(item => item.imdbID === imdbId);
                
                if (existingIndex !== -1) {
                    history.splice(existingIndex, 1);
                }
                history.unshift(details); // Add to beginning of array
                
                // Keep only last 10 items
                if (history.length > 10) {
                    history.pop();
                }
                
                chrome.storage.local.set({ watchHistory: history }, function() {
                    console.log('Watch history updated');
                });
            });

            if (isTvShow) {
                const viewerURL = chrome.runtime.getURL('viewer.html');
                window.open(`${viewerURL}?imdb=${imdbId}`, '_blank');
            } else {
                window.open(`https://vidsrc.me/embed/movie?imdb=${imdbId}`, '_blank');
            }
        } catch (error) {
            console.error('Error saving watch history:', error);
        }
    });

    container.appendChild(watchButton);

    // Insert container after the primary text
    const primaryText = document.querySelector('[data-testid="hero__primary-text"]');
    if (primaryText) {
        primaryText.insertAdjacentElement('afterend', container);
    }
}

// Initial load
addWatchButton();

// Create a debounced version of addWatchButton
let timeoutId = null;
const debouncedAddWatchButton = () => {
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(addWatchButton, 500);
};

// Observe changes
const observer = new MutationObserver(debouncedAddWatchButton);

observer.observe(document.body, {
    childList: true,
    subtree: true
}); 