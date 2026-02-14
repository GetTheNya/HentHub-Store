class HentHubUploader {
    constructor() {
        this.form = document.getElementById('upload-form');
        this.terminal = document.getElementById('status-terminal');
        this.submitBtn = document.getElementById('submit-btn');
        
        // Stages
        this.stages = [
            document.getElementById('stage-1'),
            document.getElementById('stage-2'),
            document.getElementById('stage-3')
        ];
        this.currentStage = 1;

        // Stage 1 Elements
        this.manifestInput = document.getElementById('manifest-input');
        this.manifestDropZone = document.getElementById('manifest-drop-zone');
        this.manifestPreviewText = document.getElementById('manifest-preview-text');
        this.nextToStage2Btn = document.getElementById('next-to-stage-2');

        // Stage 2 Elements
        this.appIdInput = document.getElementById('appId');
        this.nameInput = document.getElementById('name');
        this.extensionTypeInput = document.getElementById('extensionType');
        this.typeBadge = document.getElementById('type-badge');
        this.appFields = document.getElementById('app-fields');
        this.widgetFields = document.getElementById('widget-fields');
        this.iconInput = document.getElementById('icon-file');
        this.iconDropZone = document.getElementById('icon-drop-zone');
        this.screenshotsInput = document.getElementById('screenshot-files');
        this.screenshotsDropZone = document.getElementById('screenshots-drop-zone');
        this.dropZone = document.getElementById('drop-zone');
        this.sourceInput = document.getElementById('source-input');
        this.fileList = document.getElementById('file-list');
        this.idStatus = document.getElementById('id-status');
        this.terminalOnlyCheckbox = document.getElementById('terminalOnly');
        this.depSearch = document.getElementById('dep-search');
        this.depResults = document.getElementById('dep-results');
        this.selectedDepsContainer = document.getElementById('selected-deps');
        this.refreshPolicySelect = document.getElementById('refreshPolicy');
        this.intervalGroup = document.getElementById('interval-group');

        // Stage 3 Elements
        this.summaryContent = document.getElementById('summary-content');

        this.referencesSection = document.getElementById('references-section');
        this.referencesList = document.getElementById('references-list');

        this.allApps = [];
        this.selectedDependencies = new Set();
        this.isEditMode = false;
        this.editingAppId = null;
        this.initialVersion = null;
        this.currentEditingAppData = null;
        this.lastManifestIcon = null;

        this.DEFAULT_TERMINAL_ICON_PATH = 'assets/icons/terminal.png';

        // Reveal this instance for modal buttons
        window.uploader = this;

        this.init();
    }

    async init() {
        this.checkEditMode();
        await this.fetchStoreManifest();
        this.initEventListeners();
        this.checkProtocol();
        
        // Show initial stage
        if (this.isEditMode) {
            this.showStage(2);
        } else {
            this.showStage(1);
        }
    }

    checkEditMode() {
        const params = new URLSearchParams(window.location.search);
        this.editingAppId = params.get('id');
        if (this.editingAppId) {
            this.isEditMode = true;
            this.log(`Edit mode active for: ${this.editingAppId}`, 'info');
            
            // UI Updates
            const h1 = document.querySelector('.form-header h1');
            if (h1) h1.textContent = `Edit Application: ${this.editingAppId}`;
            if (this.submitBtn) this.submitBtn.textContent = 'Update Application';
            
            // App ID is read-only in edit mode
            this.appIdInput.value = this.editingAppId;
            this.appIdInput.readOnly = true;
            this.appIdInput.style.opacity = '0.7';
            this.appIdInput.style.cursor = 'not-allowed';

            // Hide Back to Stage 1 button in edit mode
            const backBtn = document.getElementById('back-to-stage-1');
            if (backBtn) backBtn.classList.add('hidden');
        }
    }

    checkProtocol() {
        if (location.protocol === 'file:' && CONFIG.mode === 'LOCAL') {
            this.log('⚠️ Running via file:// protocol. This often causes "Failed to fetch" errors. Please use: http://localhost:3000/store/upload.html', 'warning');
            this.showModal('Protocol Warning', 'You are running the store via a <b>file://</b> URL. This often causes browser security blocks when uploading to the local server.<br><br>Please use the official emulator URL:<br><a href="http://localhost:3000/store/upload.html" style="color:var(--accent)">http://localhost:3000/store/upload.html</a>', 'attention');
        }
    }

    async fetchStoreManifest() {
        try {
            const url = CONFIG.mode === 'GITHUB' 
                ? `https://${CONFIG.repoOwner}.github.io/${CONFIG.repoName}/manifests/store-manifest.json`
                : `${CONFIG.localUrl}/manifests/store-manifest.json`;
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                this.allApps = data.apps || [];
                
                // If in edit mode, populate now that data is loaded
                if (this.isEditMode) {
                    this.populateFormFromManifest(this.editingAppId);
                }
            }
        } catch (e) {
            console.error('Failed to fetch manifest for validation:', e);
        }
    }

    async populateFormFromManifest(appId) {
        let app = this.allApps.find(a => a.appId.toUpperCase() === appId.toUpperCase());
        if (!app) {
            this.log(`Error: App ${appId} not found in store manifest.`, 'error');
            return;
        }

        // Fetch full manifest if this is a slim one (e.g. missing technical fields)
        if (!app.entryPoint && !app.widgetClass) {
            this.log(`Fetching full manifest for ${appId}...`, 'info');
            try {
                const subfolder = app.extensionType === 'widget' ? 'widgets' : 'application';
                const url = CONFIG.mode === 'GITHUB'
                    ? `manifests/${subfolder}/${appId.toLowerCase()}.json`
                    : `${CONFIG.localUrl}/manifests/${subfolder}/${appId.toLowerCase()}.json`;
                
                const res = await fetch(url);
                if (res.ok) {
                    const fullManifest = await res.json();
                    app = { ...app, ...fullManifest };
                }
            } catch (err) {
                this.log(`Could not fetch full manifest: ${err.message}`, 'warning');
            }
        }

        this.currentEditingAppData = app;

        const fields = [
            'name', 'version', 'author', 'description', 
            'entryPoint', 'entryClass', 'entryMethod', 'mainClass',
            'minOSVersion'
        ];

        fields.forEach(field => {
            const val = app[field];
            if (val) {
                const inputId = field === 'mainClass' ? 'entryClass' : field;
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = val;
                    // Trigger input event to clear any error states
                    input.dispatchEvent(new Event('input'));
                }
            }
        });

        this.initialVersion = app.version;

        if (app.terminalOnly !== undefined) {
            this.terminalOnlyCheckbox.checked = app.terminalOnly;
            this.terminalOnlyCheckbox.dispatchEvent(new Event('change'));
        }

        if (app.icon) {
            this.lastManifestIcon = app.icon;
            this.log(`Existing icon: ${this.lastManifestIcon}`, 'info');
        }

        if (app.dependencies && Array.isArray(app.dependencies)) {
            app.dependencies.forEach(dep => this.addDependency(dep));
        }

        if (app.singleInstance !== undefined) {
            const siCtx = document.getElementById('singleInstance');
            if (siCtx) siCtx.checked = app.singleInstance;
        }

        if (app.permissions && Array.isArray(app.permissions)) {
            const pCtx = document.getElementById('permissions');
            if (pCtx) pCtx.value = app.permissions.join(', ');
        }

        if (app.refreshPolicy) {
            this.refreshPolicySelect.value = app.refreshPolicy;
            const isInterval = app.refreshPolicy === 'Interval';
            this.intervalGroup.classList.toggle('hidden', !isInterval);
        }
        if (app.intervalMs !== undefined) {
            document.getElementById('intervalMs').value = app.intervalMs;
        }

        // Widget-specific fields
        if (app.extensionType === 'widget') {
            this.appFields.style.display = 'none';
            this.widgetFields.style.display = 'block';
            this.extensionTypeInput.value = 'widget';
            this.typeBadge.textContent = 'Detected: Widget';

            if (app.widgetClass) document.getElementById('widgetClass').value = app.widgetClass;
            if (app.defaultSize) {
                if (app.defaultSize.width) document.getElementById('width').value = app.defaultSize.width;
                if (app.defaultSize.height) document.getElementById('height').value = app.defaultSize.height;
            }
            if (app.isResizable !== undefined) document.getElementById('isResizable').checked = app.isResizable;
            if (app.subscriptions) {
                document.getElementById('subscriptions').value = Array.isArray(app.subscriptions) ? app.subscriptions.join(', ') : app.subscriptions;
            }
        } else {
            this.appFields.style.display = 'block';
            this.widgetFields.style.display = 'none';
            this.extensionTypeInput.value = 'application';
            this.typeBadge.textContent = 'Detected: Application';
        }

        const refs = app.references || app.References || [];
        if (Array.isArray(refs) && refs.length > 0) {
            window.currentManifestReferences = refs;
            if (this.referencesSection) {
                this.referencesSection.classList.remove('hidden');
                this.referencesList.innerHTML = '';
                refs.forEach(ref => {
                    const tag = document.createElement('span');
                    tag.className = 'meta-tag';
                    tag.style.borderColor = 'var(--accent)';
                    tag.innerHTML = `<b>${ref}</b>`;
                    this.referencesList.appendChild(tag);
                });
            }
        } else {
            if (this.referencesSection) this.referencesSection.classList.add('hidden');
        }

        this.log(`Populated form for ${app.name} (Edit Mode)`, 'success');
    }

    showModal(title, body, type = 'attention') {
        const modal = document.getElementById('custom-modal');
        const mTitle = document.getElementById('modal-title');
        const mBody = document.getElementById('modal-body');
        const mIcon = document.getElementById('modal-icon');

        mTitle.textContent = title;
        mBody.innerHTML = body;
        
        modal.classList.remove('modal-error');
        if (type === 'error') {
            modal.classList.add('modal-error');
            mIcon.textContent = '❌';
        } else {
            mIcon.textContent = '⚠️';
        }

        modal.classList.add('active');

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) this.closeModal();
        };
    }

    closeModal() {
        document.getElementById('custom-modal').classList.remove('active');
    }

    setupDropZone(zone, input, previewId, onDrop = null) {
        const preview = document.getElementById(previewId);
        zone.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-file')) return;
            input.click();
        });
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('active');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('active'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('active');
            if (e.dataTransfer.files.length > 0) {
                const validFiles = this.getValidFiles(input, e.dataTransfer.files);
                if (validFiles.length > 0) {
                    this.addFilesToInput(input, validFiles);
                    this.updatePreview(input, preview, onDrop);
                    if (onDrop && !input.multiple) onDrop(validFiles[0]);
                }
            }
        });
        input.addEventListener('change', () => {
            this.updatePreview(input, preview, onDrop);
            if (onDrop && input.files.length > 0 && !input.multiple) onDrop(input.files[0]);
        });
    }

    getValidFiles(input, files) {
        const accept = input.getAttribute('accept');
        if (!accept) return Array.from(files);

        const allowedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
        const validFiles = [];
        const ignoredExtensions = [];

        Array.from(files).forEach(file => {
            const fileName = file.name.toLowerCase();
            const isMatch = allowedExtensions.some(ext => {
                if (ext.startsWith('.')) return fileName.endsWith(ext);
                if (ext.includes('/*')) {
                    const type = ext.split('/')[0];
                    return file.type.startsWith(type + '/');
                }
                return file.type === ext;
            });

            if (isMatch) validFiles.push(file);
            else ignoredExtensions.push(file.name);
        });

        if (ignoredExtensions.length > 0) {
            this.showModal('Invalid File Type', `The following files were ignored because they don't match the required format (${accept}):<br><br>• ${ignoredExtensions.join('<br>• ')}`, 'error');
        }

        return validFiles;
    }

    addFilesToInput(input, newFiles) {
        const dt = new DataTransfer();
        if (input.multiple) {
            for (let f of input.files) dt.items.add(f);
        }
        for (let f of newFiles) dt.items.add(f);
        input.files = dt.files;
    }

    updatePreview(input, previewElement, onDropCallback) {
        previewElement.innerHTML = '';
        const files = Array.from(input.files);
        
        if (files.length > 0) {
            previewElement.style.display = 'flex';
            
            // Special case for manifest (text only)
            if (input.id === 'manifest-input') {
                previewElement.textContent = files[0].name;
                previewElement.style.display = 'block';
                return;
            }

            files.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'preview-item';
                
                const removeBtn = document.createElement('div');
                removeBtn.className = 'remove-file';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeFileFromInput(input, index);
                    this.updatePreview(input, previewElement, onDropCallback);
                };

                const img = document.createElement('img');
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.readAsDataURL(file);

                const label = document.createElement('div');
                label.className = 'preview-label';
                label.textContent = file.name;

                item.appendChild(img);
                item.appendChild(removeBtn);
                item.appendChild(label);
                previewElement.appendChild(item);
            });
        } else if (input.id === 'icon-file' && this.terminalOnlyCheckbox.checked) {
            previewElement.style.display = 'flex';
            const item = document.createElement('div');
            item.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = this.DEFAULT_TERMINAL_ICON_PATH;
            
            const label = document.createElement('div');
            label.className = 'preview-label';
            label.textContent = "Default Terminal Icon";

            item.appendChild(img);
            item.appendChild(label);
            previewElement.appendChild(item);
        } else {
            previewElement.style.display = 'none';
        }
    }

    removeFileFromInput(input, index) {
        const dt = new DataTransfer();
        const files = Array.from(input.files);
        files.splice(index, 1);
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
    }

    showStage(stageNum) {
        this.stages.forEach((stage, idx) => {
            stage.style.display = (idx + 1 === stageNum) ? 'flex' : 'none';
        });
        this.currentStage = stageNum;
        window.scrollTo(0, 0);
    }

    initEventListeners() {
        // Navigation Buttons
        this.nextToStage2Btn.addEventListener('click', () => this.showStage(2));
        document.getElementById('back-to-stage-1').addEventListener('click', () => this.showStage(1));
        document.getElementById('next-to-stage-3').addEventListener('click', () => {
            if (this.validateStage2()) {
                this.renderSummary();
                this.showStage(3);
            }
        });
        document.getElementById('back-to-stage-2').addEventListener('click', () => this.showStage(2));

        // Submit Button (Stage 3)
        this.submitBtn.addEventListener('click', (e) => this.handleSubmit(e));

        // App ID availability check
        this.appIdInput.addEventListener('input', () => {
            const val = this.appIdInput.value.toUpperCase();
            if (!val || (this.isEditMode && val === this.editingAppId.toUpperCase())) {
                this.idStatus.style.display = 'none';
                return;
            }
            const exists = this.allApps.some(app => app.appId.toUpperCase() === val);
            this.idStatus.style.display = 'block';
            if (exists) {
                this.idStatus.textContent = '⚠️ ID already taken';
                this.idStatus.style.color = 'var(--error)';
            } else {
                this.idStatus.textContent = '✅ ID available';
                this.idStatus.style.color = 'var(--success)';
            }
        });

        // Widget Refresh Policy Change
        if (this.refreshPolicySelect) {
            this.refreshPolicySelect.addEventListener('change', () => {
                const isInterval = this.refreshPolicySelect.value === 'Interval';
                this.intervalGroup.classList.toggle('hidden', !isInterval);
            });
        }

        // Initialize all drop zones
        this.setupDropZone(this.manifestDropZone, this.manifestInput, 'manifest-preview-text', (file) => this.readManifestFile(file));
        this.setupDropZone(this.iconDropZone, this.iconInput, 'icon-preview');
        this.setupDropZone(this.screenshotsDropZone, this.screenshotsInput, 'screenshots-preview');
        
        // Large Source Drop Zone
        this.dropZone.addEventListener('click', () => this.sourceInput.click());
        
        const preventDefault = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        this.dropZone.addEventListener('dragover', (e) => {
            preventDefault(e);
            e.dataTransfer.dropEffect = 'copy';
            this.dropZone.classList.add('active');
        });
        this.dropZone.addEventListener('dragleave', (e) => {
            preventDefault(e);
            this.dropZone.classList.remove('active');
        });
        this.dropZone.addEventListener('drop', async (e) => {
            preventDefault(e);
            this.dropZone.classList.remove('active');
            
            this.lastManifestIcon = null;
            this.log('Processing drop...', 'info');
            
            const dropItems = e.dataTransfer.items;
            const dropFiles = e.dataTransfer.files;

            let entries = [];
            if (dropItems && dropItems.length > 0) {
                entries = Array.from(dropItems)
                    .map(item => item.webkitGetAsEntry ? item.webkitGetAsEntry() : null)
                    .filter(entry => entry !== null);
            }

            if (entries.length === 0) {
                if (dropFiles.length > 0) {
                    this.sourceInput.files = dropFiles;
                    this.updateFileList();
                }
                return;
            }

            const files = await this.scanFilesRecursively(entries);
            if (files.length > 0) {
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                this.sourceInput.files = dt.files;
                this.updateFileList();

                // If a manifest is found in the source files, update the form but don't jump stages automatically
                const manifestFile = files.find(f => f.name.toLowerCase() === 'manifest.json');
                if (manifestFile) {
                    this.readManifestFile(manifestFile, false); 
                }
            }
        });
        this.sourceInput.addEventListener('change', () => this.updateFileList());

        // Terminal Only toggle
        this.terminalOnlyCheckbox.addEventListener('change', () => {
            if (!this.iconInput.files || this.iconInput.files.length === 0) {
                this.updatePreview(this.iconInput, document.getElementById('icon-preview'));
            }
        });

        // Dependency Selector
        this.depSearch.addEventListener('input', () => this.searchDependencies());
        document.addEventListener('click', (e) => {
            if (!this.depSearch.contains(e.target)) this.depResults.style.display = 'none';
        });

        window.populateDependencies = (deps) => {
            deps.forEach(d => this.addDependency(d));
        };

        if (CONFIG.mode === 'LOCAL') {
            const tokenGroup = document.getElementById('github-token').closest('.form-group');
            if (tokenGroup) tokenGroup.style.display = 'none';
            document.getElementById('github-token').required = false;
        }
    }

    readManifestFile(file, autoJump = true) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const manifest = JSON.parse(e.target.result);
                
                // Detect Extension Type
                const type = manifest.extensionType;
                if (!type) {
                    this.showModal('Invalid Manifest', 'Manifest is missing the required <code>extensionType</code> field (must be "application" or "widget").', 'error');
                    this.manifestPreviewText.textContent = '❌ Error: Missing extensionType';
                    this.manifestPreviewText.style.color = 'var(--error)';
                    this.nextToStage2Btn.style.display = 'none';
                    return;
                }

                this.extensionTypeInput.value = type;
                this.typeBadge.textContent = `Detected: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                
                // Toggle app/widget specific fields
                if (type === 'widget') {
                    this.appFields.style.display = 'none';
                    this.widgetFields.style.display = 'block';
                    
                    // Widget specific pre-fill
                    const widgetFields = ['widgetClass', 'refreshPolicy', 'intervalMs'];
                    widgetFields.forEach(field => {
                        if (manifest[field] !== undefined) {
                            const input = document.getElementById(field);
                            if (input) input.value = manifest[field];
                        }
                    });
                    
                    if (manifest.defaultSize) {
                        if (manifest.defaultSize.width) document.getElementById('width').value = manifest.defaultSize.width;
                        if (manifest.defaultSize.height) document.getElementById('height').value = manifest.defaultSize.height;
                    }
                    
                    if (manifest.isResizable !== undefined) {
                        document.getElementById('isResizable').checked = manifest.isResizable;
                    }
                    
                    if (manifest.subscriptions && Array.isArray(manifest.subscriptions)) {
                        document.getElementById('subscriptions').value = manifest.subscriptions.join(', ');
                    }
                } else {
                    this.appFields.style.display = 'block';
                    this.widgetFields.style.display = 'none';
                    
                    // App specific pre-fill
                    const appFields = ['entryPoint', 'entryClass', 'entryMethod'];
                    appFields.forEach(field => {
                        if (manifest[field] !== undefined) {
                            const input = document.getElementById(field);
                            if (input) input.value = manifest[field];
                        }
                    });

                    if (manifest.singleInstance !== undefined) {
                        document.getElementById('singleInstance').checked = manifest.singleInstance;
                    }

                    if (manifest.terminalOnly !== undefined) {
                        this.terminalOnlyCheckbox.checked = manifest.terminalOnly;
                        this.terminalOnlyCheckbox.dispatchEvent(new Event('change'));
                    }
                }

                // Common fields pre-fill
                const commonFields = ['appId', 'name', 'version', 'author', 'description', 'minOSVersion'];
                commonFields.forEach(field => {
                    let val = manifest[field];
                    
                    // Fallback for widget "id" if "appId" is missing
                    if (field === 'appId' && val === undefined) {
                        val = manifest.id;
                    }

                    if (val !== undefined) {
                        const input = document.getElementById(field);
                        if (input) {
                            input.value = val;
                            if (field === 'appId') input.dispatchEvent(new Event('input'));
                        }
                    }
                });

                if (manifest.permissions && Array.isArray(manifest.permissions)) {
                    document.getElementById('permissions').value = manifest.permissions.join(', ');
                }

                if (manifest.refreshPolicy) {
                    this.refreshPolicySelect.value = manifest.refreshPolicy;
                    const isInterval = manifest.refreshPolicy === 'Interval';
                    this.intervalGroup.classList.toggle('hidden', !isInterval);
                }
                if (manifest.intervalMs !== undefined) {
                    document.getElementById('intervalMs').value = manifest.intervalMs;
                }

                if (manifest.icon) {
                    this.lastManifestIcon = manifest.icon;
                }

                if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
                    this.selectedDependencies.clear();
                    this.selectedDepsContainer.innerHTML = '';
                    manifest.dependencies.forEach(d => this.addDependency(d));
                }

                // Handle References (Read-only)
                const refs = manifest.references || manifest.References || [];
                window.currentManifestReferences = refs;
                
                if (Array.isArray(refs) && refs.length > 0) {
                    this.log(`Detected ${refs.length} library references`, 'info');
                    if (this.referencesSection) {
                        this.referencesSection.classList.remove('hidden');
                        this.referencesList.innerHTML = '';
                        refs.forEach(ref => {
                            const tag = document.createElement('span');
                            tag.className = 'meta-tag';
                            tag.style.borderColor = 'var(--accent)';
                            tag.innerHTML = `<b>${ref}</b>`;
                            this.referencesList.appendChild(tag);
                        });
                    }
                } else {
                    if (this.referencesSection) this.referencesSection.classList.add('hidden');
                }

                if (autoJump) {
                    this.manifestPreviewText.textContent = `✅ ${file.name} loaded (${type})`;
                    this.manifestPreviewText.style.display = 'block';
                    this.nextToStage2Btn.style.display = 'block';
                    this.showStage(2);
                }

                this.log(`Manifest loaded: ${file.name} (${type})`, 'success');
            } catch (err) {
                this.showModal('Parse Error', 'Error parsing manifest.json. Please ensure it is valid JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }

    validateStage2() {
        return this.validateForm();
    }

    renderSummary() {
        const type = this.extensionTypeInput.value;
        const appId = this.appIdInput.value;
        const name = this.nameInput.value;
        const author = document.getElementById('author').value;
        const version = document.getElementById('version').value;
        const desc = document.getElementById('description').value;

        let iconSrc = 'favicon.png'; // Fallback
        const iconFile = this.iconInput.files[0];
        if (iconFile) {
            iconSrc = URL.createObjectURL(iconFile);
        } else if (this.terminalOnlyCheckbox.checked) {
            iconSrc = this.DEFAULT_TERMINAL_ICON_PATH;
        }

        const screenshots = Array.from(this.screenshotsInput.files);
        const screenshotPreviews = screenshots.map(f => `<img src="${URL.createObjectURL(f)}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">`).join('');

        this.summaryContent.innerHTML = `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                <div style="display: flex; gap: 30px; align-items: flex-start;">
                    <img src="${iconSrc}" style="width: 120px; height: 120px; border-radius: 24px; background: #222; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h2 style="margin: 0; font-size: 2rem;">${name}</h2>
                            <span class="tag" style="background: var(--accent);">${type.toUpperCase()}</span>
                        </div>
                        <div style="color: var(--text-muted); margin-bottom: 15px; font-size: 1.1rem;">
                            by <b style="color: var(--text-main);">${author}</b> • v${version}
                        </div>
                        <p style="font-size: 1rem; line-height: 1.6; color: rgba(255,255,255,0.8); margin-bottom: 20px;">
                            ${desc || 'No description provided.'}
                        </p>
                    </div>
                </div>

                <div style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: var(--text-muted); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Store Preview (Screenshots)</h4>
                    <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;">
                        ${screenshotPreviews || '<div style="color: var(--text-dim); font-style: italic;">No screenshots uploaded.</div>'}
                    </div>
                </div>

                <div style="margin-top: 20px; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 20px;">
                    <h4 style="margin-bottom: 15px; color: var(--text-muted); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Technical Specifications</h4>
                    <div class="grid-2" style="font-size: 0.9rem;">
                        <div>
                            <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Package ID:</span> <code>${appId}</code></div>
                            <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">OS Requirement:</span> <code>v${document.getElementById('minOSVersion').value}</code></div>
                            ${type === 'application' ? `
                                <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Entry:</span> <code>${document.getElementById('entryClass').value}.${document.getElementById('entryMethod').value}</code></div>
                            ` : `
                                <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Widget Class:</span> <code>${document.getElementById('widgetClass').value}</code></div>
                                <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Size:</span> <code>${document.getElementById('width').value}x${document.getElementById('height').value}</code></div>
                            `}
                        </div>
                        <div>
                            <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Permissions:</span> <code>${document.getElementById('permissions').value || 'NONE'}</code></div>
                            <div style="margin-bottom: 8px;"><span style="color: var(--text-muted);">Files:</span> ${this.sourceInput.files.length} detected</div>
                        </div>
                    </div>
                    
                    ${window.currentManifestReferences && window.currentManifestReferences.length > 0 ? `
                        <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                            <span style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 8px;">LIBRARY REFERENCES</span>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${window.currentManifestReferences.map(ref => `<span class="meta-tag" style="border-color: var(--accent); white-space: nowrap;"><b>${ref}</b></span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                <p>⚠️ Files will be uploaded to <code>store/${type === 'application' ? 'packages/application' : 'packages/widgets'}</code></p>
            </div>
        `;
    }

    validateForm() {
        const type = this.extensionTypeInput.value;
        const mandatory = [
            { id: 'appId', label: 'App ID' },
            { id: 'name', label: 'App Name' },
            { id: 'version', label: 'Version' },
            { id: 'author', label: 'Author' }
        ];

        if (type === 'widget') {
            mandatory.push({ id: 'widgetClass', label: 'Widget Class' });
            mandatory.push({ id: 'width', label: 'Width' });
            mandatory.push({ id: 'height', label: 'Height' });
        } else {
            mandatory.push({ id: 'entryPoint', label: 'Entry Point' });
            mandatory.push({ id: 'entryClass', label: 'Entry Class' });
            mandatory.push({ id: 'entryMethod', label: 'Entry Method' });
        }

        // Icon is mandatory only if NOT a terminal app OR if an icon is specifically selected
        const isTerminalFallback = this.terminalOnlyCheckbox.checked;
        if (!isTerminalFallback && type !== 'widget') {
            mandatory.push({ id: 'icon-file', label: 'Package Icon', isFile: true, zoneId: 'icon-drop-zone' });
        } else if (type === 'widget') {
            // Widgets ALWAYS need an icon for now (or a default)
            mandatory.push({ id: 'icon-file', label: 'Widget Icon', isFile: true, zoneId: 'icon-drop-zone' });
        }
        
        mandatory.push({ id: 'source-input', label: 'Source Files', isFile: true, zoneId: 'drop-zone' });

        let errors = [];
        // Clear previous errors
        document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

        mandatory.forEach(field => {
            const input = document.getElementById(field.id);
            let isValid = true;

            if (field.isFile) {
                // In Edit Mode, files are optional unless the user explicitly wants to update them
                if (!input.files || input.files.length === 0) {
                    if (!this.isEditMode) isValid = false;
                }
            } else {
                if (!input || !input.value || !input.value.trim()) isValid = false;
            }

            if (!isValid) {
                errors.push(field.label);
                const highlightEl = field.zoneId ? document.getElementById(field.zoneId) : input;
                if (highlightEl) highlightEl.classList.add('field-error');
            }
        });

        // Version enforcement in Edit Mode: Force version change if files are updated
        if (this.isEditMode) {
            const hasNewFiles = (this.sourceInput.files && this.sourceInput.files.length > 0) || 
                               (this.iconInput.files && this.iconInput.files.length > 0);
            const currentVersion = document.getElementById('version').value.trim();
            
            if (hasNewFiles && currentVersion === this.initialVersion) {
                errors.push('New version number (files updated)');
                document.getElementById('version').classList.add('field-error');
                this.log('Files updated - please increment the version number.', 'error');
            }
        }

        // GitHub Token check (if mode is GITHUB)
        const token = document.getElementById('github-token');
        if (CONFIG.mode === 'GITHUB' && !token.value.trim()) {
            errors.push('GitHub Token');
            token.classList.add('field-error');
        }

        // Folder Validation: Check if manifest.json and the icon (from manifest) exist in the source folder
        if (this.sourceInput.files.length > 0) {
            const files = Array.from(this.sourceInput.files);
            
            // Find manifest.json (Normalization: handle both slashes and root-ness)
            const manifestFile = files.find(f => {
                const name = f.name.toLowerCase();
                const path = (f.webkitRelativePath || "").toLowerCase().replace(/\\/g, '/');
                return name === 'manifest.json' || path.endsWith('/manifest.json') || path === 'manifest.json';
            });
            
            if (!manifestFile) {
                errors.push('manifest.json (inside folder)');
                this.dropZone.classList.add('field-error');
                this.log('Manifest not found in uploaded files.', 'error');
                console.log('Files scanned:', files.map(f => f.webkitRelativePath || f.name));
            } else {
                this.log(`Detected manifest: ${manifestFile.webkitRelativePath || manifestFile.name}`, 'info');
            }

            // 3. Icon Validation (Skip if terminal app)
            if (!this.terminalOnlyCheckbox.checked) {
                const manualIcon = document.getElementById('icon-file').files[0];
                const expectedIconName = (this.lastManifestIcon || "icon.png").toLowerCase();
                
                const iconMatch = files.find(f => {
                    const path = (f.webkitRelativePath || f.name).toLowerCase().replace(/\\/g, '/');
                    const parts = path.split('/');
                    const name = parts[parts.length - 1];
                    const isRoot = parts.length <= 2; 
                    return isRoot && name === expectedIconName;
                });

                if (!iconMatch && !manualIcon) {
                    errors.push(`App icon '${expectedIconName}' (missing from folder root and manual upload)`);
                    this.dropZone.classList.add('field-error');
                } else if (manualIcon && manualIcon.name.toLowerCase() !== expectedIconName) {
                    errors.push(`Manual icon name '${manualIcon.name}' does not match manifest icon name '${expectedIconName}'`);
                    this.iconDropZone.classList.add('field-error');
                }
            }
        }

        if (errors.length > 0) {
            this.terminal.style.display = 'block';
            this.log(`Validation failed: Missing ${errors.join(', ')}`, 'error');
            this.showModal('Validation Failed', `The following items are missing or invalid:<br><br>• ${errors.join('<br>• ')}`, 'error');
            return false;
        }

        return true;
    }

    updateFileList() {
        const files = this.sourceInput.files;
        if (files.length === 0) {
            this.fileList.style.display = 'none';
            return;
        }

        // Recursive counting: the browser file list is already flat, so length IS the count of all files inside.
        this.fileList.style.display = 'block';
        this.fileList.innerHTML = `<strong>Found ${files.length} total files:</strong><br>` + 
            Array.from(files).slice(0, 5).map(f => f.webkitRelativePath || f.name).join('<br>') +
            (files.length > 5 ? `<br>...and ${files.length - 5} more` : '');
    }

    searchDependencies() {
        const query = this.depSearch.value.toLowerCase();
        if (!query) {
            this.depResults.style.display = 'none';
            return;
        }

        const currentId = this.appIdInput.value.toUpperCase();
        const filtered = this.allApps.filter(app => 
            (app.name.toLowerCase().includes(query) || app.appId.toLowerCase().includes(query)) &&
            !this.selectedDependencies.has(app.appId) &&
            app.appId.toUpperCase() !== currentId
        );

        if (filtered.length === 0) {
            this.depResults.style.display = 'none';
            return;
        }

        this.depResults.innerHTML = '';
        filtered.forEach(app => {
            const div = document.createElement('div');
            div.className = 'dependency-item';
            div.textContent = `${app.name} (${app.appId})`;
            div.onclick = () => this.addDependency(app.appId);
            this.depResults.appendChild(div);
        });
        this.depResults.style.display = 'block';
    }

    addDependency(appId) {
        const currentId = this.appIdInput.value.toUpperCase();
        if (appId.toUpperCase() === currentId) {
            this.log(`Cannot add ${appId} as a dependency to itself.`, 'warning');
            return;
        }
        if (this.selectedDependencies.has(appId)) return;
        this.selectedDependencies.add(appId);
        
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `${appId} <span class="remove">&times;</span>`;
        tag.querySelector('.remove').onclick = () => {
            this.selectedDependencies.delete(appId);
            tag.remove();
        };
        this.selectedDepsContainer.appendChild(tag);
        this.depSearch.value = '';
        this.depResults.style.display = 'none';
    }

    log(message, type = 'info') {
        const line = document.createElement('div');
        line.textContent = `> ${message}`;
        if (type === 'error') line.style.color = 'var(--error)';
        if (type === 'success') line.style.color = 'var(--success)';
        this.terminal.appendChild(line);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Form Validation
        if (!this.validateForm()) return;

        // Final ID check (Skip if in Edit Mode for the same ID)
        const appId = this.appIdInput.value.toUpperCase();
        if (!this.isEditMode && this.allApps.some(app => app.appId.toUpperCase() === appId)) {
            this.showModal('Duplicate ID', `Error: App ID <b>${appId}</b> is already taken. Please choose another one.`, 'error');
            return;
        }

        this.terminal.style.display = 'block';
        this.terminal.innerHTML = '<div>> Initializing uploader...</div>';
        this.submitBtn.disabled = true;

        try {
            const token = document.getElementById('github-token').value;
            const version = document.getElementById('version').value;
            const screenshotFiles = document.getElementById('screenshot-files').files;
            
            this.log('Creating .hub package...', 'info');
            const zipBlob = await this.createZip();
            if (zipBlob) {
                this.log(`.hub package created (${(zipBlob.size / 1024).toFixed(2)} KB)`, 'success');
            } else {
                this.log('No new files to package.', 'info');
            }

            const type = this.extensionTypeInput.value;
            const subfolder = type === 'widget' ? 'widgets' : 'application';
            const fileName = `${appId.toLowerCase()}-v${version}.hub`;
            
            // Paths relative to root (Emulator or Repo)
            const packagePath = `packages/${subfolder}/${fileName}`;
            const iconPath = `assets/icons/${subfolder}/${appId.toLowerCase()}.png`;

            const iconFile = document.getElementById('icon-file').files[0];
            let iconBase64;
            
            if (iconFile) {
                iconBase64 = await this.fileToBase64(iconFile);
            } else if (this.terminalOnlyCheckbox.checked) {
                // Fetch the default terminal icon and convert to base64
                const resp = await fetch(this.DEFAULT_TERMINAL_ICON_PATH);
                const blob = await resp.blob();
                iconBase64 = await this.fileToBase64(blob);
            } else if (!this.isEditMode) {
                throw new Error("Missing package icon.");
            }

            let packageBase64 = null;
            if (zipBlob) {
                packageBase64 = await this.fileToBase64(zipBlob);
            }

            // Prepare Screenshots for upload
            const screenshots = [];
            for (let i = 0; i < screenshotFiles.length; i++) {
                const content = await this.fileToBase64(screenshotFiles[i]);
                screenshots.push({
                    path: `store/assets/screenshots/${subfolder}/${appId.toLowerCase()}/${i}.png`,
                    content: content
                });
            }

            const pVal = document.getElementById('permissions').value;
            const permissions = pVal ? pVal.split(',').map(p => p.trim()).filter(p => p) : [];

            const appMetadata = {
                appId,
                name: document.getElementById('name').value,
                extensionType: type,
                version,
                author: document.getElementById('author').value,
                description: document.getElementById('description').value,
                terminalOnly: this.terminalOnlyCheckbox.checked,
                singleInstance: document.getElementById('singleInstance').checked,
                minOSVersion: document.getElementById('minOSVersion').value || '1.0.0',
                permissions: permissions,
                entryPoint: document.getElementById('entryPoint').value,
                entryClass: document.getElementById('entryClass').value,
                entryMethod: document.getElementById('entryMethod').value,
                // Widget specific fields
                widgetClass: document.getElementById('widgetClass').value,
                defaultSize: {
                    width: parseFloat(document.getElementById('width').value),
                    height: parseFloat(document.getElementById('height').value)
                },
                isResizable: document.getElementById('isResizable').checked,
                refreshPolicy: document.getElementById('refreshPolicy').value,
                intervalMs: parseInt(document.getElementById('intervalMs').value || 0),
                subscriptions: document.getElementById('subscriptions').value.split(',').map(s => s.trim()).filter(s => s),
                
                size: zipBlob ? zipBlob.size : (this.currentEditingAppData ? this.currentEditingAppData.size : 0),
                icon: `${appId.toLowerCase()}.png`,
                screenshotCount: screenshotFiles.length > 0 ? screenshotFiles.length : (this.currentEditingAppData ? this.currentEditingAppData.screenshotCount : 0),
                dependencies: Array.from(this.selectedDependencies),
                references: window.currentManifestReferences || []
            };
            
            if (CONFIG.mode === 'GITHUB') {
                this.log(`Uploading to GitHub: ${CONFIG.repoOwner}/${CONFIG.repoName}...`, 'info');
                await this.uploadToGitHub(token, packagePath, packageBase64, iconPath, iconBase64, screenshots, appMetadata);
            } else {
                this.log('Uploading to Local Emulator...', 'info');
                await this.uploadToLocal(packagePath, packageBase64, iconPath, iconBase64, screenshots, appMetadata);
            }
            
            this.log('Upload successful!', 'success');
            alert('Application uploaded and published successfully!');
            location.reload();

        } catch (err) {
            this.log(`Error: ${err.message}`, 'error');
            console.error(err);
        } finally {
            this.submitBtn.disabled = false;
        }
    }

    async fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
    }

    async createZip() {
        let zip = new JSZip();
        const sourceFiles = this.sourceInput.files;
        const iconFile = document.getElementById('icon-file').files[0];
        const screenshotFiles = document.getElementById('screenshot-files').files;
        
        let existingManifestData = null;

        // --- Archive Patching Logic ---
        if (sourceFiles.length === 0 && this.isEditMode && this.currentEditingAppData) {
            this.log('Metadata-only update detected. Patching existing archive...', 'info');
            try {
                const appId = this.currentEditingAppData.appId.toLowerCase();
                const version = this.initialVersion;
                const fileName = `${appId}-v${version}.hub`;
                const url = CONFIG.mode === 'GITHUB'
                    ? `https://${CONFIG.repoOwner}.github.io/${CONFIG.repoName}/packages/${fileName}`
                    : `${CONFIG.localUrl}/packages/${fileName}`;

                this.log(`Fetching existing archive for patching: ${fileName}`, 'info');
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`Could not fetch existing archive: ${resp.statusText}`);
                
                const arrayBuffer = await resp.arrayBuffer();
                zip = await JSZip.loadAsync(arrayBuffer);
                this.log('Existing archive loaded. Updating manifest...', 'success');
            } catch (err) {
                this.log(`Archive patching failed: ${err.message}. Creating new partial archive.`, 'warning');
                // Fallback to empty zip if patch fails
            }
        }

        // 1. Determine Icon Filename (Strict priority: manual upload > manifest > fallback)
        let finalIconName = this.lastManifestIcon || "icon.png";
        if (iconFile) finalIconName = iconFile.name; // Manual upload overrides name
        
        const pVal = document.getElementById('permissions').value;
        const permissions = pVal ? pVal.split(',').map(p => p.trim()).filter(p => p) : [];

        const manifest = {
            appId: this.appIdInput.value.toUpperCase(),
            ...(this.extensionTypeInput.value === 'widget' ? { id: this.appIdInput.value.toUpperCase() } : {}),
            name: document.getElementById('name').value,
            extensionType: this.extensionTypeInput.value,
            version: document.getElementById('version').value,
            author: document.getElementById('author').value,
            description: document.getElementById('description').value,
            entryPoint: document.getElementById('entryPoint').value,
            entryClass: document.getElementById('entryClass').value,
            entryMethod: document.getElementById('entryMethod').value,
            // Widget specific fields
            widgetClass: document.getElementById('widgetClass').value,
            defaultSize: {
                width: parseFloat(document.getElementById('width').value),
                height: parseFloat(document.getElementById('height').value)
            },
            isResizable: document.getElementById('isResizable').checked,
            refreshPolicy: document.getElementById('refreshPolicy').value,
            intervalMs: parseInt(document.getElementById('intervalMs').value || 0),
            subscriptions: document.getElementById('subscriptions').value.split(',').map(s => s.trim()).filter(s => s),

            terminalOnly: this.terminalOnlyCheckbox.checked,
            singleInstance: document.getElementById('singleInstance').checked,
            minOSVersion: document.getElementById('minOSVersion').value || '1.0.0',
            permissions: permissions,
            icon: "icon.png", // Inside the package, it's always icon.png
            dependencies: Array.from(this.selectedDependencies),
            references: window.currentManifestReferences || []
        };
        
        // Write or add root manifest.json
        const syncedManifestContent = JSON.stringify(manifest, null, 2);
        zip.file("manifest.json", syncedManifestContent);

        // --- Multi-Manifest Synchronization ---
        // We ensure EVERY manifest.json in the package is updated to match.
        // This handles cases where the zip already contains a nested manifest (e.g. In MyApp.sapp/manifest.json)
        zip.forEach((relativePath, file) => {
            if (relativePath.toLowerCase().endsWith('/manifest.json')) {
                this.log(`Syncing internal manifest: ${relativePath}`, 'info');
                zip.file(relativePath, syncedManifestContent);
            }
        });

        // 2. Handle Icon (Standardize to icon.png inside Zip)
        if (iconFile) {
            zip.file("icon.png", iconFile);
        } else if (this.terminalOnlyCheckbox.checked && !this.isEditMode) {
            // Only add default if NOT in edit mode or explicitly requested
            const resp = await fetch(this.DEFAULT_TERMINAL_ICON_PATH);
            const iconBlob = await resp.blob();
            zip.file("icon.png", iconBlob);
        }

        if (screenshotFiles.length > 0) {
            const ssFolder = zip.folder("screenshots");
            for (let i = 0; i < screenshotFiles.length; i++) {
                ssFolder.file(`${i}.png`, screenshotFiles[i]);
            }
        }

        if (sourceFiles.length > 0) {
            for (let file of sourceFiles) {
                const path = file.webkitRelativePath || file.name;
                const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
                
                // Root manifest is already handled
                if (normalizedPath === 'manifest.json') continue;

                // If it's a nested manifest, sync it
                if (normalizedPath.endsWith('/manifest.json')) {
                    zip.file(path, JSON.stringify(manifest, null, 2));
                    continue;
                }
                
                zip.file(path, file);
            }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        return zipBlob;
    }

    async uploadToLocal(pkgPath, pkgContent, iconPath, iconContent, screenshots, metadata) {
        const upload = async (p, c) => {
            const res = await fetch(`${CONFIG.localUrl}/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: p, content: c })
            });
            if (!res.ok) throw new Error(`Local upload failed for ${p}`);
        };

        this.log('Updating assets locally...');
        if (pkgContent) await upload(pkgPath, pkgContent);
        if (iconContent) await upload(iconPath, iconContent);
        
        for (const ss of screenshots) {
            await upload(ss.path, ss.content);
        }

        // 3. Save FULL individual manifest
        const subfolder = metadata.extensionType === 'widget' ? 'widgets' : 'application';
        const individualManifestPath = `manifests/${subfolder}/${metadata.appId.toLowerCase()}.json`;
        this.log(`Saving individual manifest: ${individualManifestPath}...`);
        await fetch(`${CONFIG.localUrl}/update-manifest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: individualManifestPath, content: metadata })
        });

        // 4. Update browsing manifest (SLIM)
        this.log('Updating local store manifest (slim)...');
        const manifestPath = 'manifests/store-manifest.json';
        let manifestData = { apps: [] };
        try {
            const res = await fetch(`${CONFIG.localUrl}/${manifestPath}`);
            if (res.ok) {
                manifestData = await res.json();
                if (!manifestData.apps) manifestData.apps = [];
            }
        } catch (e) {}

        const slimEntry = {
            appId: metadata.appId,
            name: metadata.name,
            extensionType: metadata.extensionType,
            version: metadata.version,
            author: metadata.author,
            description: metadata.description,
            minOSVersion: metadata.minOSVersion,
            terminalOnly: metadata.terminalOnly,
            screenshotCount: metadata.screenshotCount,
            downloadUrl: `${CONFIG.localUrl}/${pkgPath}`,
            iconUrl: `${CONFIG.localUrl}/${iconPath}`,
            publishedDate: new Date().toISOString()
        };

        const idx = manifestData.apps.findIndex(a => a.appId === metadata.appId);
        if (idx >= 0) manifestData.apps[idx] = slimEntry;
        else manifestData.apps.push(slimEntry);

        manifestData.lastUpdated = new Date().toISOString();

        await fetch(`${CONFIG.localUrl}/update-manifest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: manifestPath, content: manifestData })
        });
    }

    async uploadToGitHub(token, pkgPath, pkgContent, iconPath, iconContent, screenshots, metadata) {
        const owner = CONFIG.repoOwner;
        const repo = CONFIG.repoName;
        const appId = metadata.appId;
        const version = metadata.version;
        const subfolder = metadata.extensionType === 'widget' ? 'widgets' : 'application';
        
        const githubPut = async (path, content, message, sha = null) => {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, content, sha })
            });
            if (!res.ok) throw new Error(`GitHub Upload Failed for ${path}: ${(await res.json()).message}`);
        };

        const getSha = async (path) => {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (res.ok) return (await res.json()).sha;
            return null;
        };

        // Push .hub (Only if new files were selected)
        if (pkgContent) {
            this.log('Pushing .hub to GitHub...');
            const hubSha = await getSha(pkgPath);
            await githubPut(pkgPath, pkgContent, `Update ${metadata.appId} package (v${metadata.version})`, hubSha);
        } else {
            this.log('Skipping package push (no new files).', 'info');
        }

        // Push Icon (Only if new icon was selected)
        if (iconContent) {
            this.log('Pushing Icon to GitHub...');
            const iconSha = await getSha(iconPath);
            await githubPut(iconPath, iconContent, `Update ${metadata.appId} icon`, iconSha);
        }

        // Push Screenshots
        this.log('Pushing Screenshots to GitHub...');
        for (const ss of screenshots) {
            const ssSha = await getSha(ss.path);
            await githubPut(ss.path, ss.content, `Upload ${metadata.appId} screenshot`, ssSha);
        }

        // 5. Update browsing manifest (SLIM)
        this.log('Updating GitHub store manifest (slim)...');
        const manifestPath = 'manifests/store-manifest.json';
        const manifestSha = await getSha(manifestPath);
        let manifestData = { apps: [] };
        
        const mRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${manifestPath}`);
        if (mRes.ok) {
            const mData = await mRes.json();
            manifestData = JSON.parse(atob(mData.content));
            if (!manifestData.apps) manifestData.apps = [];
        }

        const slimEntry = {
            appId: metadata.appId,
            name: metadata.name,
            extensionType: metadata.extensionType,
            version: metadata.version,
            author: metadata.author,
            description: metadata.description,
            minOSVersion: metadata.minOSVersion,
            terminalOnly: metadata.terminalOnly,
            screenshotCount: metadata.screenshotCount,
            downloadUrl: `https://${owner}.github.io/${repo}/packages/${subfolder}/${appId.toLowerCase()}-v${version}.hub`,
            iconUrl: `https://${owner}.github.io/${repo}/assets/icons/${subfolder}/${appId.toLowerCase()}.png`,
            publishedDate: new Date().toISOString()
        };

        const idx = manifestData.apps.findIndex(a => a.appId === metadata.appId);
        if (idx >= 0) manifestData.apps[idx] = slimEntry;
        else manifestData.apps.push(slimEntry);

        manifestData.lastUpdated = new Date().toISOString();
        await githubPut(manifestPath, btoa(JSON.stringify(manifestData, null, 2)), `Update store manifest (slim): ${metadata.appId}`, manifestSha);
        
        // 6. Save FULL individual manifest
        const individualManifestPath = `manifests/${subfolder}/${metadata.appId.toLowerCase()}.json`;
        this.log(`Pushing individual manifest to GitHub: ${individualManifestPath}...`);
        const individualSha = await getSha(individualManifestPath);
        await githubPut(individualManifestPath, btoa(JSON.stringify(metadata, null, 2)), `Save full manifest: ${metadata.appId}`, individualSha);
    }

    async scanFilesRecursively(entries) {
        const files = [];
        
        const scanEntry = async (entry, path = "") => {
            if (entry.isFile) {
                const file = await new Promise(r => entry.file(r));
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: path + entry.name,
                    writable: false
                });
                files.push(file);
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const readEntries = async () => {
                    const results = await new Promise(r => reader.readEntries(r));
                    if (results.length > 0) {
                        for (const subEntry of results) {
                            await scanEntry(subEntry, path + entry.name + "/");
                        }
                        await readEntries(); // Read next batch
                    }
                };
                await readEntries();
            }
        };

        for (const entry of entries) {
            await scanEntry(entry);
        }
        return files;
    }
}

new HentHubUploader();

