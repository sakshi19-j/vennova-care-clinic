const { app, BrowserWindow, Menu } = require('electron');

const APP_URL = 'https://vennova-care-clinic.vercel.app';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: 'electron/icon.ico',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Hides the default File/Edit/View menu bar for a cleaner app feel
  Menu.setApplicationMenu(null);

  mainWindow.loadURL(APP_URL);

  // If the load fails (e.g. no internet), show a simple retry screen
  // instead of a blank/broken page.
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(`
          <html>
            <body style="
              font-family: -apple-system, Segoe UI, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f7f7f8;
              color: #333;
            ">
              <div style="text-align: center;">
                <h2>No connection</h2>
                <p>Vennova Clinic OS needs an internet connection.</p>
                <button onclick="location.reload()" style="
                  padding: 10px 20px;
                  font-size: 14px;
                  border-radius: 6px;
                  border: none;
                  background: #4f46e5;
                  color: white;
                  cursor: pointer;
                ">Retry</button>
              </div>
            </body>
          </html>
        `)
    );
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
