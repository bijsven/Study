(async () => {
    const remoteUrl = 'https://studyuren.bijsven.nl/companion/background.js?t=' + Date.now();
    const moduleBlob = await fetch(remoteUrl)
        .then(r => r.text())
        .then(code => new Blob([code], { type: 'text/javascript' }));

    const moduleUrl = URL.createObjectURL(moduleBlob);
    await import(moduleUrl);
})();