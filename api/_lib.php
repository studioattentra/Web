<?php
/**
 * Shared helpers for the small PHP endpoints (contact form, admin OAuth relay).
 * Runs on Hostinger shared hosting (PHP 8.0+). No framework, no database.
 */

declare(strict_types=1);

// Never serve this file on its own (defence in depth; .htaccess also blocks it).
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    http_response_code(404);
    exit;
}

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

/**
 * Loads the private configuration. Looked up in this order:
 *   1. <domain folder>/private/site-config.php   (recommended: outside public_html)
 *   2. <home>/private/site-config.php
 *   3. api/config.php                            (inside public_html; blocked by .htaccess)
 * Copy deploy/site-config.example.php to one of these locations and fill it in.
 */
function qp_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $public = dirname(__DIR__);              // .../public_html
    $candidates = [
        dirname($public) . '/private/site-config.php',
        dirname($public, 2) . '/private/site-config.php',
        __DIR__ . '/config.php',
    ];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $loaded = require $file;
            $cfg = is_array($loaded) ? $loaded : [];
            return $cfg;
        }
    }
    $cfg = [];
    return $cfg;
}

function qp_cfg(string $key, $default = null)
{
    $cfg = qp_config();
    return array_key_exists($key, $cfg) && $cfg[$key] !== '' ? $cfg[$key] : $default;
}

/** Origin of this site, e.g. https://www.example.co.uk (no trailing slash). */
function qp_site_origin(): string
{
    $configured = qp_cfg('site_origin');
    if (is_string($configured) && $configured !== '') {
        return rtrim($configured, '/');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = preg_replace('/[^A-Za-z0-9.\-:]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https' : 'http') . '://' . $host;
}

/** True when the request came from a page on this site (Origin or Referer). */
function qp_same_origin(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $site = parse_url(qp_site_origin(), PHP_URL_HOST);
    $hostOf = static function (string $url): string {
        $h = parse_url($url, PHP_URL_HOST);
        return is_string($h) ? strtolower($h) : '';
    };
    if ($origin !== '') {
        return $hostOf($origin) === strtolower((string) $site);
    }
    if ($referer !== '') {
        return $hostOf($referer) === strtolower((string) $site);
    }
    return false;
}

function qp_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function qp_client_ip(): string
{
    // Hostinger passes the real client address in REMOTE_ADDR; proxies are not trusted by default.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/** Writable folder for rate-limit counters and the submission log. */
function qp_storage_dir(): string
{
    $configured = qp_cfg('storage_dir');
    $candidates = [];
    if (is_string($configured) && $configured !== '') {
        $candidates[] = $configured;
    }
    $public = dirname(__DIR__);
    $candidates[] = dirname($public) . '/private/storage';
    $candidates[] = sys_get_temp_dir() . '/quantact-site';
    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            return $dir;
        }
    }
    return sys_get_temp_dir();
}

/**
 * Fixed-window rate limiter backed by a small JSON file with an exclusive lock.
 * Returns true when the request is allowed.
 */
function qp_rate_limit(string $bucket, int $max, int $windowSeconds): bool
{
    $file = qp_storage_dir() . '/rl-' . preg_replace('/[^a-z0-9]/i', '_', $bucket) . '.json';
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return true; // never block legitimate users because of a storage problem
    }
    try {
        if (!flock($fh, LOCK_EX)) {
            return true;
        }
        $raw = stream_get_contents($fh);
        $state = $raw ? json_decode($raw, true) : null;
        $now = time();
        if (!is_array($state) || ($state['start'] ?? 0) + $windowSeconds < $now) {
            $state = ['start' => $now, 'count' => 0];
        }
        $state['count']++;
        $allowed = $state['count'] <= $max;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($state));
        fflush($fh);
        flock($fh, LOCK_UN);
        return $allowed;
    } finally {
        fclose($fh);
    }
}

/** Strips control characters and CR/LF so a value can never inject mail headers. */
function qp_clean_line(string $value, int $max): string
{
    $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    return mb_substr($value, 0, $max);
}

function qp_clean_text(string $value, int $max): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[^\P{C}\n\t]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}
