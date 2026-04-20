export const discordClient = (url, delay = 5000) => {
  let waiting = [];
  let promise = null;
  return (message) => {
    if (!url) {
      return;
    }
    waiting.push(message);
    if (promise) {
      return promise;
    }
    promise = new Promise((resolve) => {
      setTimeout(() => {
        fetch(url, {
          method: 'post',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({ content: waiting.join('\n-----\n') }),
        }).then(r => {
          resolve();
          promise = null;
          waiting = [];
          return r.text();
        });
      }, delay);
    });
    return promise;
  };
};
