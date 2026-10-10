/* Final step of the admin login: pass the token to the Decap CMS window
   using its documented postMessage handshake, and only to our own origin. */
(function () {
  'use strict';
  var script = document.currentScript;
  var token = script.getAttribute('data-token');
  var origin = script.getAttribute('data-origin');
  var provider = script.getAttribute('data-provider') || 'github';
  script.removeAttribute('data-token');

  if (!window.opener || !token) {
    document.body.textContent = 'This window should be opened from the admin login. You can close it.';
    return;
  }

  function receive(e) {
    if (e.origin !== origin) return;
    if (typeof e.data !== 'string' || e.data.indexOf('authorizing:' + provider) !== 0) return;
    window.opener.postMessage(
      'authorization:' + provider + ':success:' + JSON.stringify({ token: token, provider: provider }),
      e.origin
    );
    window.removeEventListener('message', receive, false);
    token = null;
    setTimeout(function () { window.close(); }, 250);
  }

  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:' + provider, origin);
})();
