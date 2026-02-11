let allApps = [];

async function loadApps() {
    const standardList = document.getElementById('standard-app-list');
    const terminalList = document.getElementById('terminal-app-list');
    const searchInput = document.getElementById('store-search');

    try {
        let manifestUrl;
        if (CONFIG.mode === 'GITHUB') {
            manifestUrl = `https://${CONFIG.repoOwner}.github.io/${CONFIG.repoName}/manifests/store-manifest.json`;
        } else {
            manifestUrl = `${CONFIG.localUrl}/manifests/store-manifest.json`;
        }
        
        console.log(`Fetching manifest from: ${manifestUrl}`);
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Could not fetch manifest');
        
        const data = await response.json();
        allApps = data.apps || [];
        
        renderApps(allApps);

        // Add search listener
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = allApps.filter(app => 
                app.name.toLowerCase().includes(query) || 
                app.appId.toLowerCase().includes(query)
            );
            renderApps(filtered);
        });
        
    } catch (err) {
        console.error(err);
        const errorMsg = `<p style="color: var(--error)">Error loading store: ${err.message}</p>`;
        if (standardList) standardList.innerHTML = errorMsg;
        if (terminalList) terminalList.innerHTML = errorMsg;
    }
}

function renderApps(apps) {
    const standardList = document.getElementById('standard-app-list');
    const terminalList = document.getElementById('terminal-app-list');
    const standardSection = document.getElementById('standard-apps-section');
    const terminalSection = document.getElementById('terminal-apps-section');

    standardList.innerHTML = '';
    terminalList.innerHTML = '';

    const standardApps = apps.filter(app => !app.terminalOnly);
    const terminalApps = apps.filter(app => app.terminalOnly);

    // Toggle section visibility
    standardSection.style.display = standardApps.length > 0 ? 'block' : 'none';
    terminalSection.style.display = terminalApps.length > 0 ? 'block' : 'none';

    if (apps.length === 0) {
        standardSection.style.display = 'block';
        standardList.innerHTML = '<p>No applications match your search.</p>';
        return;
    }

    standardApps.forEach(app => standardList.appendChild(createAppCard(app)));
    terminalApps.forEach(app => terminalList.appendChild(createAppCard(app)));
}

function createAppCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    let iconUrl = app.iconUrl;
    if (!iconUrl) {
        if (CONFIG.mode === 'GITHUB') {
            iconUrl = `https://github.com/${CONFIG.repoOwner}/${CONFIG.repoName}/raw/main/assets/icons/${app.appId.toLowerCase()}.png`;
        } else {
            iconUrl = `${CONFIG.localUrl}/assets/icons/${app.appId.toLowerCase()}.png`;
        }
    }
    
    card.innerHTML = `
        <img src="${iconUrl}" class="app-icon" alt="${app.name}" onerror="this.src='https://via.placeholder.com/64?text=App'">
        <div class="app-title">
            ${app.name}
            ${app.terminalOnly ? '<span class="badge badge-terminal">Terminal</span>' : ''}
        </div>
        <div class="app-author">by ${app.author}</div>
        <div class="app-desc">${app.description || 'No description available.'}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">v${app.version}</div>
        <div style="display: flex; gap: 10px; width: 100%;">
            <a href="app.html?id=${app.appId}" style="flex: 1;"><button style="width: 100%; background: rgba(255,255,255,0.1);">View Details</button></a>
            <a href="henthub://id?=${app.appId}" style="flex: 1;"><button style="width: 100%;">Install</button></a>
        </div>
    `;
    return card;
}

loadApps();

