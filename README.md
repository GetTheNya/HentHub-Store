# HentHub Store 🏪

The official application marketplace for the **HentOS Simulator**. Browse, discover, and install applications directly into your simulated environment.

## ⚡ Quick Start

### 1. Start the Local Emulator
```bash
cd store-emulator
npm install
npm start
```

### 2. Open the Store
*   **Storefront**: [`http://localhost:3000/store/index.html`](http://localhost:3000/store/index.html)
*   **Developer Portal**: [`http://localhost:3000/store/upload.html`](http://localhost:3000/store/upload.html)

---

## ✨ Features

*   **📱 App Discovery**: Browse a curated collection of both Standard (GUI) and Terminal applications.
*   **⚡ One-Click Install**: Seamless integration with HentOS via the custom `henthub://` protocol.
*   **🛠️ Developer Portal**: Tools to upload, update, and manage your own applications.
*   **Dependency Management**: Automatically resolves and installs shared libraries and required apps.
*   **🔄 Dual Mode**: Designed to run on GitHub Pages (Production) or a local Node.js emulator (Development) for easy testing.

---

## 🚀 Detailed Setup

### Prerequisites

*   [Node.js](https://nodejs.org/) (Required for local emulation)
*   **HentOS Simulator** (Required to install apps)

### Running Locally (Emulator)

To test the store locally without deploying to GitHub:

1.  Navigate to the emulator directory:
    ```bash
    cd store-emulator
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the emulator:
    ```bash
    npm start
    ```
4.  The server acts as a mock GitHub API, handling uploads and file serving.

---

## 🤝 Contributing an App

### Method 1: Developer Portal (Recommended)

The easiest way to publish or update an app is using the built-in **Developer Portal**.

1.  Open the **Developer Portal**:
    *   **Local**: [`http://localhost:3000/store/upload.html`](http://localhost:3000/store/upload.html)
    *   **Production**: Open `store/upload.html` in your browser.
2.  **Fill in App Details**:
    *   **App ID**: A unique, internal identifier (e.g., `NOTEPAD`).
    *   **Version**: Semantic versioning (e.g., `1.0.0`).
    *   **Entry Point**: The main executable file (e.g., `Program.cs`).
3.  **Drag & Drop Source**: Drop your application's **source folder** into the "Source Files" zone.
    *   *Note: The portal will automatically package your files into a `.hub` archive.*
4.  **Add Assets**: Drop an icon (`.png`) and screenshots.
5.  **Authenticate**: Enter your GitHub Token (if uploading to Production).
6.  **Upload**: Click **Prepare & Upload Package**.
    *   The tool will automatically:
        *   📦 Create the `.hub` package.
        *   ☁️ Upload the package and assets to the repository.
        *   📝 Update `store/manifests/store-manifest.json`.

### Method 2: Manual Upload

If you prefer to do it manually:

1.  **Build & Package**: Zip your application files (ensure `manifest.json` is at the root) and rename the `.zip` to `.hub`.
2.  **Place Files**:
    *   Put the `.hub` file in `store/packages/`.
    *   Put the `icon.png` in `store/assets/icons/`.
3.  **Update Manifest**:
    *   Edit `store/manifests/store-manifest.json`.
    *   Add a new entry to the `apps` array with your app's details.
4.  **Submit PR**: Create a Pull Request with your changes.

---

## 📜 Manifest Specification

Every app in the store is defined by a JSON object in `store-manifest.json`.

```json
{
  "appId": "MYAPP",           // Unique Identifier (UPPERCASE)
  "name": "My Application",   // Display Name
  "version": "1.0.0",         // Semantic Version
  "author": "Developer Name", // Creator
  "description": "...",       // Short description
  "terminalOnly": false,      // true if it runs in Terminal
  "singleInstance": true,     // true if only one instance allowed
  "minOSVersion": "v1.0.0",   // Minimum HentOS version required
  "entryPoint": "Program.cs", // Main script file
  "entryClass": "MyApp.Program", // Namespace.ClassName
  "entryMethod": "Main",      // Method to call
  "size": 1024,               // Size in bytes
  "icon": "icon.png",         // Icon filename inside package
  "dependencies": ["TERMINAL"], // List of AppIDs required
  "references": ["FontStashSharp"], // List of DLL references
  "downloadUrl": "...",       // Full URL to .hub file
  "iconUrl": "..."            // Full URL to icon image
}
```

---

## 🧩 Dependency System

HentOS supports a robust dependency system. Apps can declare dependencies on other apps (like `TERMINAL` or `SAPPC`).

*   **Recursive Resolution**: When a user installs an app, the store automatically calculates the full dependency tree.
*   **Auto-Installation**: All missing dependencies are added to the download queue and installed in the correct order.
*   **Shared Libraries**: Common libraries should be packaged as separate "Library Apps" to save space and ensure version consistency.

---

## ⚙️ Configuration

The store can be configured to point to the live GitHub repository or your local emulator.

Edit `store/assets/js/config.js` to switch modes:

```javascript
const CONFIG = {
    mode: 'LOCALHOST', // Options: 'GITHUB' or 'LOCALHOST'
    localUrl: 'http://localhost:3000',
    repoOwner: 'GetTheNya',
    repoName: 'HentHub-Store'
};
```

---

## ❓ Troubleshooting

### "Failed to fetch" on Localhost
If you are running the store via `file://` protocol (doubly clicking `index.html`), browsers will block API requests to `localhost:3000`.
*   **Fix**: Always access the store via `http://localhost:3000/store/index.html` provided by the emulator.

### Icons not showing
*   Ensure naming convention matches: `assets/icons/{appId}.png` (lowercase).
*   Check if `iconUrl` in manifest is an absolute URL or relative path based on your config.

### Update requires new version
*   The Developer Portal enforces version changes when files are modified. If you are just updating metadata (description, author), you can keep the same version.

---

*Part of the HentOS Ecosystem.*