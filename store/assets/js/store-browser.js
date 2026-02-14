let allApps = [];
let currentTab = 'apps';

async function loadApps() {
    const searchInput = document.getElementById('store-search');
    const tabApps = document.getElementById('tab-apps');
    const tabWidgets = document.getElementById('tab-widgets');

    tabApps.addEventListener('click', () => switchTab('apps'));
    tabWidgets.addEventListener('click', () => switchTab('widgets'));

    try {
        let manifestUrl;
        if (CONFIG.mode === 'GITHUB') {
            manifestUrl = 'manifests/store-manifest.json';
        } else {
            manifestUrl = `${CONFIG.localUrl}/store/manifests/store-manifest.json`;
        }
        
        console.log(`Fetching manifest from: ${manifestUrl}`);
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Could not fetch manifest');
        
        const data = await response.json();
        allApps = data.apps || [];
        
        renderApps(allApps);

        // Add search listener
        searchInput.addEventListener('input', () => {
            renderApps(allApps);
        });
        
    } catch (err) {
        console.error(err);
        const errorMsg = `<p style="color: var(--error)">Error loading store: ${err.message}</p>`;
        const containers = ['standard-app-list', 'terminal-app-list', 'widget-list'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = errorMsg;
        });
    }
}

function switchTab(tab) {
    if (currentTab === tab) return;

    const oldContainer = currentTab === 'apps' ? document.getElementById('apps-container') : document.getElementById('widgets-container');
    const newContainer = tab === 'apps' ? document.getElementById('apps-container') : document.getElementById('widgets-container');
    
    const tabApps = document.getElementById('tab-apps');
    const tabWidgets = document.getElementById('tab-widgets');

    // Start transition
    oldContainer.classList.add('fade-out');

    setTimeout(() => {
        currentTab = tab;
        
        // Update tab decorations
        if (tab === 'apps') {
            tabApps.classList.add('active');
            tabApps.style.color = 'var(--text-main)';
            tabWidgets.classList.remove('active');
            tabWidgets.style.color = 'var(--text-dim)';
        } else {
            tabWidgets.classList.add('active');
            tabWidgets.style.color = 'var(--text-main)';
            tabApps.classList.remove('active');
            tabApps.style.color = 'var(--text-dim)';
        }

        // Toggle visibility
        oldContainer.classList.add('hidden');
        oldContainer.classList.remove('fade-out');
        newContainer.classList.remove('hidden');
        
        renderApps(allApps);
    }, 300);
}

function renderApps(apps) {
    const query = document.getElementById('store-search').value.toLowerCase();
    const filtered = apps.filter(app => 
        app.name.toLowerCase().includes(query) || 
        app.appId.toLowerCase().includes(query)
    );

    const standardList = document.getElementById('standard-app-list');
    const terminalList = document.getElementById('terminal-app-list');
    const widgetList = document.getElementById('widget-list');
    
    const standardSection = document.getElementById('standard-apps-section');
    const terminalSection = document.getElementById('terminal-apps-section');

    standardList.innerHTML = '';
    terminalList.innerHTML = '';
    widgetList.innerHTML = '';

    if (currentTab === 'apps') {
        const standardApps = filtered.filter(app => (app.extensionType === 'application' || !app.extensionType) && !app.terminalOnly);
        const terminalApps = filtered.filter(app => (app.extensionType === 'application' || !app.extensionType) && app.terminalOnly);

        standardSection.style.display = standardApps.length > 0 ? 'block' : 'none';
        terminalSection.style.display = terminalApps.length > 0 ? 'block' : 'none';

        if (standardApps.length === 0 && terminalApps.length === 0) {
            standardList.innerHTML = '<p>No applications match your search.</p>';
            standardSection.style.display = 'block';
        } else {
            standardApps.forEach(app => standardList.appendChild(createAppCard(app)));
            terminalApps.forEach(app => terminalList.appendChild(createAppCard(app)));
        }
    } else {
        const widgets = filtered.filter(app => app.extensionType === 'widget');
        
        if (widgets.length === 0) {
            widgetList.innerHTML = '<p>No widgets match your search.</p>';
        } else {
            widgets.forEach(app => widgetList.appendChild(createAppCard(app)));
        }
    }
}

function createAppCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    // Determine type-specific prefix for assets
    const type = app.extensionType || 'application';
    const typePrefix = type === 'widget' ? 'widgets/' : 'application/';
    
    let iconUrl = app.iconUrl;
    if (!iconUrl) {
        if (CONFIG.mode === 'GITHUB') {
            iconUrl = `assets/icons/${typePrefix}${app.appId.toLowerCase()}.png`;
        } else {
            iconUrl = `${CONFIG.localUrl}/store/assets/icons/${typePrefix}${app.appId.toLowerCase()}.png`;
        }
    }
    
    card.innerHTML = `
        <img src="${iconUrl}" class="app-icon" alt="${app.name}" onerror="this.src='favicon.png'">
        <div class="app-title">
            ${app.name}
            ${app.terminalOnly ? '<span class="badge badge-terminal">Terminal</span>' : ''}
            ${type === 'widget' ? '<span class="badge" style="background:var(--accent); font-size: 0.7rem; vertical-align: middle; margin-left: 5px; padding: 2px 6px; border-radius: 4px;">Widget</span>' : ''}
        </div>
        <div class="meta-tags" style="justify-content: center;">
            <span class="meta-tag meta-tag-author">by <b>${app.author}</b></span>
            <span class="meta-tag meta-tag-os">Min OS: <b>${app.minOSVersion || '1.0.0'}</b></span>
        </div>
        <div class="app-desc">${app.description || 'No description available.'}</div>
        <div class="meta-tags" style="justify-content: center; margin-bottom: 10px;">
            <span class="meta-tag meta-tag-version">v<b>${app.version}</b></span>
        </div>
        <div style="display: flex; gap: 10px; width: 100%;">
            <a href="app.html?id=${app.appId}" style="flex: 1;"><button style="width: 100%; background: rgba(255,255,255,0.1);">View Details</button></a>
            <a href="henthub://id?=${app.appId}" style="flex: 1;"><button style="width: 100%;">Install</button></a>
        </div>
    `;
    return card;
}

loadApps();

