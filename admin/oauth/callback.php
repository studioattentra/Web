<?php
/**
 * Step 2 of the GitHub login for the content admin.
 * GitHub sends the owner back here with ?code=...&state=... ; we check the
 * state, exchange the code for an access token (server to server, using the
 * client secret that never leaves the server) and hand the token to the
 * Decap window through the standard postMessage handshake (complete.js).
 */

declare(strict_types=1);

require dirname(__DIR__, 2) . '/api/_lib.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('Content-Type: text/html; charset=utf-8');

function qp_fail(string $message): void
{
    http_response_code(400);
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Login failed</title></head>"
       . "<body style=\"font-family:system-ui;background:#0e1312;color:#F6F5EF;padding:40px\">"
       . "<h1 style=\"font-weight:400\">Login failed</h1><p>{$safe}</p><p><a style=\"color:#B7C7A3\" href=\"/admin/\">Back to the admin</a></p></body></html>";
    exit;
}

$clientId     = (string) qp_cfg('github_client_id', '');
$clientSecret = (string) qp_cfg('github_client_secret', '');
if ($clientId === '' || $clientSecret === '') {
    qp_fail('Admin login is not configured yet.');
}

$code  = (string) ($_GET['code'] ?? '');
$state = (string) ($_GET['state'] ?? '');
$saved = (string) ($_COOKIE['qp_oauth_state'] ?? '');
setcookie('qp_oauth_state', '', ['expires' => time() - 3600, 'path' => '/admin/oauth/']);

if (isset($_GET['error'])) {
    qp_fail('GitHub reported: ' . (string) ($_GET['error_description'] ?? $_GET['error']));
}
if ($code === '' || $state === '' || $saved === '' || !hash_equals($saved, $state)) {
    qp_fail('The login request could not be verified. Please close this window and try again.');
}

// Exchange the code for a token.
$payload = http_build_query([
    'client_id'     => $clientId,
    'client_secret' => $clientSecret,
    'code'          => $code,
    'redirect_uri'  => qp_site_origin() . '/admin/oauth/callback.php',
]);
$ch = curl_init('https://github.com/login/oauth/access_token');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded', 'User-Agent: quantact-site-admin'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
$status   = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

$data = is_string($response) ? json_decode($response, true) : null;
if ($status !== 200 || !is_array($data) || empty($data['access_token'])) {
    error_log('oauth callback: token exchange failed (' . $status . ')');
    qp_fail('GitHub did not issue a token. Please try again.');
}

$token    = (string) $data['access_token'];
$origin   = qp_site_origin();
$attrTok  = htmlspecialchars($token, ENT_QUOTES, 'UTF-8');
$attrOrig = htmlspecialchars($origin, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>Signing in…</title>
</head>
<body style="font-family:system-ui;background:#0e1312;color:#F6F5EF;padding:40px">
  <p>Signing you in… this window closes by itself.</p>
  <script src="complete.js" data-provider="github" data-origin="<?= $attrOrig ?>" data-token="<?= $attrTok ?>"></script>
</body>
</html>
