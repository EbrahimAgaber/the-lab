const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const distIndex = path.join(__dirname, '..', 'packages', 'ui', 'dist', 'index.html');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
  });

  const targets = [
    { name: 'work-orders-ar-rtl-light.png', query: '?lang=ar&theme=light' },
    { name: 'work-orders-ar-rtl-dark.png', query: '?lang=ar&theme=dark' },
    { name: 'work-orders-en-ltr-light.png', query: '?lang=en&theme=light' },
    { name: 'work-orders-en-ltr-dark.png', query: '?lang=en&theme=dark' },
  ];

  for (const t of targets) {
    const fileUrl = 'file:///' + distIndex.replace(/\\/g, '/') + t.query;
    console.log('Loading ' + fileUrl);
    await win.loadURL(fileUrl);
    await new Promise((r) => setTimeout(r, 800));
    const image = await win.capturePage();
    const dest = path.join(outDir, t.name);
    fs.writeFileSync(dest, image.toPNG());
    const stat = fs.statSync(dest);
    console.log(`Saved ${t.name} (${stat.size} bytes)`);
  }

  app.quit();
});
