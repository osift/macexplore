const GITHUB_REPO = 'osift/macexplore';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

let currentVersion = null;
let latestRelease = null;
let updateDismissed = false;

async function getAppVersion() {
    if (currentVersion) return currentVersion;
    try {
        const result = await pywebview.api.get_app_version();
        currentVersion = result.version || '1.0.0';
    } catch (e) {
        currentVersion = '1.0.0';
    }
    return currentVersion;
}

async function checkForUpdates() {
    if (updateDismissed) return;

    const version = await getAppVersion();

    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            console.log('Update check failed:', response.status);
            return;
        }

        const release = await response.json();
        latestRelease = release;

        const latestVersion = release.tag_name.replace(/^v/, '');

        if (isNewerVersion(latestVersion, version)) {
            showUpdateBar(latestVersion);
        }
    } catch (error) {
        console.log('Update check error:', error);
    }
}

function isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

function showUpdateBar(version) {
    const updateNotice = document.getElementById('updateNotice');
    const updateVersion = document.getElementById('updateVersion');

    if (updateNotice && updateVersion) {
        updateVersion.textContent = `v${version}`;
        updateNotice.style.display = 'flex';
    }
}

function dismissUpdate() {
    const updateNotice = document.getElementById('updateNotice');
    if (updateNotice) {
        updateNotice.style.display = 'none';
    }
    updateDismissed = true;
}

async function performUpdate() {
    if (!latestRelease) {
        showAlert('Error', 'No update information available. Please try again.', 'error');
        return;
    }

    const dmgAsset = latestRelease.assets.find(asset =>
        asset.name.toLowerCase().endsWith('.dmg')
    );

    if (!dmgAsset) {

        window.open(latestRelease.html_url, '_blank');
        showAlert('Update', 'No direct download available. Opening release page...', 'info');
        return;
    }

    showProgressAlert('Updating', 'Downloading update...');

    try {

        const result = await pywebview.api.download_and_install_update(dmgAsset.browser_download_url);

        closeProgressAlert();

        if (result.success) {
            showAlert('Update Downloaded', 'Open the DMG and drag MacExplore to Applications to replace the current version.', 'success', () => {
                if (result.dmg_path) {
                    pywebview.api.reveal_in_finder(result.dmg_path);
                }
            });
        } else {
            showAlert('Update Failed', result.error || 'Failed to download update. Please try manually.', 'error', () => {
                window.open(latestRelease.html_url, '_blank');
            });
        }
    } catch (error) {
        closeProgressAlert();
        showAlert('Update Failed', 'Failed to download update: ' + error.message, 'error', () => {
            window.open(latestRelease.html_url, '_blank');
        });
    }
}

async function updateVersionDisplay() {
    const appVersion = document.getElementById('appVersion');
    if (appVersion) {
        const version = await getAppVersion();
        appVersion.textContent = version;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateVersionDisplay, 100);

    setTimeout(checkForUpdates, 3000);
});
