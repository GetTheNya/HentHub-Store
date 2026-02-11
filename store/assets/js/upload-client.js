class HentHubUploader {
    constructor() {
        this.form = document.getElementById('upload-form');
        this.terminal = document.getElementById('status-terminal');
        this.submitBtn = document.getElementById('submit-btn');
        this.dropZone = document.getElementById('drop-zone');
        this.sourceInput = document.getElementById('source-input');
        this.fileList = document.getElementById('file-list');
        this.appIdInput = document.getElementById('appId');
        this.idStatus = document.getElementById('id-status');
        this.depSearch = document.getElementById('dep-search');
        this.depResults = document.getElementById('dep-results');
        this.selectedDepsContainer = document.getElementById('selected-deps');
        
        this.selectedDependencies = new Set();
        this.allApps = [];

        // New Drop Zones
        this.manifestDropZone = document.getElementById('manifest-drop-zone');
        this.manifestInput = document.getElementById('manifest-input');
        this.iconDropZone = document.getElementById('icon-drop-zone');
        this.iconInput = document.getElementById('icon-file');
        this.screenshotsDropZone = document.getElementById('screenshots-drop-zone');
        this.screenshotsInput = document.getElementById('screenshot-files');
        this.terminalOnlyCheckbox = document.getElementById('terminalOnly');
        this.DEFAULT_TERMINAL_ICON_PATH = 'assets/icons/terminal_app.png';
        this.lastManifestIcon = null;
        this.isEditMode = false;
        this.editingAppId = null;
        this.initialVersion = null;
        this.currentEditingAppData = null;

        this.initEventListeners();
        this.fetchStoreManifest();

        // Reveal this instance for modal buttons
        window.uploader = this;

        this.checkEditMode();
        this.checkProtocol();
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

    populateFormFromManifest(appId) {
        const app = this.allApps.find(a => a.appId.toUpperCase() === appId.toUpperCase());
        if (!app) {
            this.log(`Error: App ${appId} not found in store manifest.`, 'error');
            return;
        }

        this.currentEditingAppData = app;

        const fields = [
            'name', 'version', 'author', 'description', 
            'entryPoint', 'entryClass', 'entryMethod', 'mainClass'
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

        if (app.references && Array.isArray(app.references)) {
            window.currentManifestReferences = app.references;
            const refDisplay = document.getElementById('references-display');
            if (refDisplay) {
                refDisplay.textContent = app.references.join(', ');
                refDisplay.style.color = 'var(--text-main)';
            }
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

    initEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

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

        // Initialize all drop zones
        this.setupDropZone(this.manifestDropZone, this.manifestInput, 'manifest-preview', (file) => this.readManifestFile(file));
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

            this.log(`Drop detected: ${dropItems ? dropItems.length : 0} items, ${dropFiles ? dropFiles.length : 0} files.`, 'info');

            let entries = [];
            if (dropItems && dropItems.length > 0) {
                entries = Array.from(dropItems)
                    .map(item => item.webkitGetAsEntry ? item.webkitGetAsEntry() : null)
                    .filter(entry => entry !== null);
            }

            // Fallback for when DataTransferItem/webkitGetAsEntry isn't robust
            if (entries.length === 0) {
                if (dropFiles.length > 0) {
                    this.log('Using flat file list fallback.', 'warning');
                    this.sourceInput.files = dropFiles;
                    this.updateFileList();
                    
                    if (dropFiles.length === 1 && dropFiles[0].size === 0) {
                        this.log('Warning: This browser version may not support recursive folder drops. Try using the file picker instead.', 'error');
                    }
                } else {
                    this.log('No files detected in drop.', 'error');
                }
                return;
            }

            this.log(`Scanning ${entries.length} top-level entries...`, 'info');
            const files = await this.scanFilesRecursively(entries);
            this.log(`Scan complete: Found ${files.length} files.`, 'success');
            
            if (files.length > 0) {
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                this.sourceInput.files = dt.files;
                this.updateFileList();

                const manifestFile = files.find(f => {
                    const name = f.name.toLowerCase();
                    const path = (f.webkitRelativePath || "").toLowerCase().replace(/\\/g, '/');
                    return name === 'manifest.json' || path.endsWith('/manifest.json') || path === 'manifest.json';
                });
                if (manifestFile) {
                    this.readManifestFile(manifestFile);
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

    readManifestFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const manifest = JSON.parse(e.target.result);
                const fields = [
                    'appId', 'name', 'version', 'author', 
                    'description', 'entryPoint', 'entryClass', 'entryMethod'
                ];
                fields.forEach(field => {
                    if (manifest[field] !== undefined) {
                        const input = document.getElementById(field);
                        if (input) {
                            input.value = manifest[field];
                            // Trigger input event for ID check
                            if (field === 'appId') input.dispatchEvent(new Event('input'));
                        }
                    }
                });

                if (manifest.singleInstance !== undefined) {
                    const siCtx = document.getElementById('singleInstance');
                    if (siCtx) siCtx.checked = manifest.singleInstance;
                }

                if (manifest.permissions && Array.isArray(manifest.permissions)) {
                    const pCtx = document.getElementById('permissions');
                    if (pCtx) pCtx.value = manifest.permissions.join(', ');
                }

                if (manifest.terminalOnly !== undefined) {
                    this.terminalOnlyCheckbox.checked = manifest.terminalOnly;
                    this.terminalOnlyCheckbox.dispatchEvent(new Event('change'));
                }

                if (manifest.icon) {
                    this.lastManifestIcon = manifest.icon;
                    this.log(`Manifest specifies icon: ${this.lastManifestIcon}`, 'info');
                }

                const refDisplay = document.getElementById('references-display');
                if (manifest.references && Array.isArray(manifest.references) && manifest.references.length > 0) {
                    window.currentManifestReferences = manifest.references;
                    if (refDisplay) {
                        refDisplay.textContent = manifest.references.join(', ');
                        refDisplay.style.color = 'var(--text-main)';
                    }
                } else {
                    window.currentManifestReferences = [];
                    if (refDisplay) {
                        refDisplay.textContent = 'None';
                        refDisplay.style.color = 'var(--text-dim)';
                    }
                }

                if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
                    this.selectedDependencies.clear();
                    this.selectedDepsContainer.innerHTML = '';
                    manifest.dependencies.forEach(d => this.addDependency(d));
                }
                
                this.showModal('Form Auto-filled', 'Values have been synchronized from your <code>manifest.json</code> successfully!');
            } catch (err) {
                this.showModal('Parse Error', 'Error parsing manifest.json. Please ensure it is valid JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }

    validateForm() {
        const mandatory = [
            { id: 'appId', label: 'App ID' },
            { id: 'name', label: 'App Name' },
            { id: 'version', label: 'Version' },
            { id: 'author', label: 'Author' },
            { id: 'entryPoint', label: 'Entry Point' },
            { id: 'entryClass', label: 'Entry Class' },
            { id: 'entryMethod', label: 'Entry Method' }
        ];

        // Icon is mandatory only if NOT a terminal app OR if an icon is specifically selected
        const isTerminalFallback = this.terminalOnlyCheckbox.checked;
        if (!isTerminalFallback) {
            mandatory.push({ id: 'icon-file', label: 'App Icon', isFile: true, zoneId: 'icon-drop-zone' });
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

            const fileName = `${appId.toLowerCase()}-v${version}.hub`;
            const packagePath = `store/packages/${fileName}`;
            const iconPath = `store/assets/icons/${appId.toLowerCase()}.png`;

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
                throw new Error("Missing application icon.");
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
                    path: `store/assets/screenshots/${appId.toLowerCase()}/${i}.png`,
                    content: content
                });
            }

            const pVal = document.getElementById('permissions').value;
            const permissions = pVal ? pVal.split(',').map(p => p.trim()).filter(p => p) : [];

            const appMetadata = {
                appId,
                name: document.getElementById('name').value,
                version,
                author: document.getElementById('author').value,
                description: document.getElementById('description').value,
                terminalOnly: this.terminalOnlyCheckbox.checked,
                singleInstance: document.getElementById('singleInstance').checked,
                permissions: permissions,
                entryPoint: document.getElementById('entryPoint').value,
                entryClass: document.getElementById('entryClass').value,
                entryMethod: document.getElementById('entryMethod').value,
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
            name: document.getElementById('name').value,
            version: document.getElementById('version').value,
            author: document.getElementById('author').value,
            description: document.getElementById('description').value,
            entryPoint: document.getElementById('entryPoint').value,
            entryClass: document.getElementById('entryClass').value,
            entryMethod: document.getElementById('entryMethod').value,
            terminalOnly: this.terminalOnlyCheckbox.checked,
            singleInstance: document.getElementById('singleInstance').checked,
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

        // 3. Update manifest
        this.log('Updating local store manifest...');
        const manifestPath = 'manifests/store-manifest.json';
        let manifestData = { apps: [] };
        try {
            const res = await fetch(`${CONFIG.localUrl}/${manifestPath}`);
            if (res.ok) {
                manifestData = await res.json();
                if (!manifestData.apps) manifestData.apps = [];
            }
        } catch (e) {}

        const appEntry = {
            ...metadata,
            downloadUrl: `${CONFIG.localUrl}/${pkgPath}`,
            iconUrl: `${CONFIG.localUrl}/${iconPath}`,
            publishedDate: new Date().toISOString()
        };

        const idx = manifestData.apps.findIndex(a => a.appId === metadata.appId);
        if (idx >= 0) manifestData.apps[idx] = appEntry;
        else manifestData.apps.push(appEntry);

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

        // Update manifest
        this.log('Updating GitHub manifest...');
        const manifestPath = 'store/manifests/store-manifest.json';
        const manifestUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${manifestPath}`;

        const getRes = await fetch(manifestUrl, { headers: { 'Authorization': `token ${token}` } });
        let sha = null;
        let manifestData = { apps: [] };
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            manifestData = JSON.parse(atob(data.content));
            if (!manifestData.apps) manifestData.apps = [];
        }

        const appEntry = {
            ...metadata,
            downloadUrl: `https://github.com/${owner}/${repo}/raw/main/${pkgPath}`,
            iconUrl: `https://github.com/${owner}/${repo}/raw/main/${iconPath}`,
            publishedDate: new Date().toISOString()
        };

        const idx = manifestData.apps.findIndex(a => a.appId === metadata.appId);
        if (idx >= 0) manifestData.apps[idx] = appEntry;
        else manifestData.apps.push(appEntry);

        manifestData.lastUpdated = new Date().toISOString();

        await githubPut(manifestPath, btoa(JSON.stringify(manifestData, null, 2)), `Update manifest for ${metadata.appId}`, sha);
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

