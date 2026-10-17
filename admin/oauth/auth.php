<?php
/**
 * Step 1 of the GitHub login for the content admin (Decap CMS "github" backend).
 * Decap opens this in a popup: /admin/oauth/auth.php?provider=github&scope=repo
 * We remember a random state in a short-lived cookie and send the owner to GitHub.
 */

declare(strict_types=1);

require dirname(__DIR__, 2) . '/api/_lib.php';

header('Cache-Control: no-store');

$clientId = (string) qp_cfg('github_client_id', '');
if ($clientId === '') {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Admin login is not configured yet (github_client_id missing in site-config.php).";
    exit;
}

$provider = (string) ($_GET['provider'] ?? 'github');
if ($provider !== 'github') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Unsupported provider.';
    exit;
}

$scope = (string) ($_GET['scope'] ?? 'repo');
$scope = in_array($scope, ['repo', 'public_repo'], true) ? $scope : 'repo';

$state = bin2hex(random_bytes(16));
setcookie('qp_oauth_state', $state, [
    'expires'  => time() + 600,
    'path'     => '/admin/oauth/',
    'secure'   => str_starts_with(qp_site_origin(), 'https://'),
    'httponly' => true,
    'samesite' => 'Lax',
]);

$params = http_build_query([
    'client_id'    => $clientId,
    'redirect_uri' => qp_site_origin() . '/admin/oauth/callback.php',
    'scope'        => $scope,
    'state'        => $state,
    'allow_signup' => 'false',
]);

header('Location: https://github.com/login/oauth/authorize?' . $params, true, 302);
exit;
