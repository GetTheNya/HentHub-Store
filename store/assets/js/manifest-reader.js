document.getElementById('manifest-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const manifest = JSON.parse(e.target.result);
            
            // Map manifest fields to form inputs
            const fields = [
                'appId', 'name', 'version', 'author', 
                'description', 'entryPoint', 'entryClass', 'entryMethod'
            ];

            fields.forEach(field => {
                if (manifest[field] !== undefined) {
                    const input = document.getElementById(field);
                    if (input) input.value = manifest[field];
                }
            });

            // Handle references (read-only)
            const refDisplay = document.getElementById('references-display');
            if (manifest.references && Array.isArray(manifest.references) && manifest.references.length > 0) {
                refDisplay.textContent = manifest.references.join(', ');
                refDisplay.style.color = 'var(--text-main)';
                // Store references globally so the uploader can include them
                window.currentManifestReferences = manifest.references;
            } else {
                refDisplay.textContent = 'No references found.';
                refDisplay.style.color = 'var(--text-muted)';
                window.currentManifestReferences = [];
            }

            // Handle dependencies if any
            if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
                // This will be handled by the dependency selector logic in upload-client.js
                if (window.populateDependencies) {
                    window.populateDependencies(manifest.dependencies);
                }
            }

            console.log('Manifest loaded successfully:', manifest);
            alert('Form auto-filled from manifest.json!');
        } catch (err) {
            console.error('Error parsing manifest:', err);
            alert('Error parsing manifest.json. Please ensure it is valid JSON.');
        }
    };
    reader.readAsText(file);
});
