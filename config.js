async function verifyToken(token) {
    try {
        const response = await fetch('https://api.themoviedb.org/3/authentication', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function saveConfig() {
    const token = document.getElementById('tmdb-token').value.trim();
    const error = document.getElementById('error');
    const success = document.getElementById('success');
    
    error.style.display = 'none';
    success.style.display = 'none';

    if (!token) {
        error.textContent = 'Please enter a token';
        error.style.display = 'block';
        return;
    }

    const isValid = await verifyToken(token);
    if (!isValid) {
        error.textContent = 'Invalid token. Please check and try again.';
        error.style.display = 'block';
        return;
    }

    await chrome.storage.local.set({ 
        tmdbToken: token,
        theme: document.getElementById('theme-switch').checked ? 'dark' : 'light'
    });

    success.textContent = 'Settings saved successfully!';
    success.style.display = 'block';

    // Close the configuration page after a brief delay
    setTimeout(() => {
        window.close();
    }, 1500);
}

async function loadConfig() {
    const result = await chrome.storage.local.get(['tmdbToken', 'theme']);
    if (result.tmdbToken) {
        document.getElementById('tmdb-token').value = result.tmdbToken;
    }
    document.getElementById('theme-switch').checked = result.theme === 'dark';
    updateTheme(result.theme === 'dark');
}

function updateTheme(isDark) {
    document.body.classList.toggle('dark', isDark);
}

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    document.getElementById('save-token').addEventListener('click', saveConfig);
    document.getElementById('theme-switch').addEventListener('change', (e) => {
        updateTheme(e.target.checked);
    });
}); 