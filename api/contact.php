<?php
/**
 * Enquiry form handler — POST api/contact.php
 *
 * Validates and sanitises the fields, applies rate limits, keeps a private
 * log line (so nothing is lost if mail delivery is delayed) and emails the
 * enquiry to the address in the private configuration.
 *
 * Responds with JSON: { ok: true } or { ok: false, error: "message" }.
 * The front end falls back to the visitor's own email app if this endpoint
 * is unreachable, so the form keeps working even before PHP is configured.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    qp_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
}
if (!qp_same_origin()) {
    qp_json(403, ['ok' => false, 'error' => 'Request must come from the website.']);
}

// Honeypot: real visitors never see or fill this field.
if (!empty($_POST['website'])) {
    qp_json(200, ['ok' => true]); // pretend success to the bot
}

// Rate limits: per visitor and site-wide.
if (!qp_rate_limit('ip-' . qp_client_ip(), (int) qp_cfg('rate_limit_per_ip', 5), 3600)) {
    qp_json(429, ['ok' => false, 'error' => 'Too many enquiries from this connection. Please try again in an hour.']);
}
if (!qp_rate_limit('global', (int) qp_cfg('rate_limit_global', 60), 3600)) {
    qp_json(429, ['ok' => false, 'error' => 'We are receiving a lot of enquiries right now. Please try again shortly.']);
}

$services = [
    'Limited Company Accounts & CT600s', 'Management Accounts & Reporting', 'Tax Compliance & Advisory',
    'VAT Bookkeeping', 'Personal Tax Returns', 'Sole Trader, Partnership & LLP Accounts',
    'Data Migration', 'CIS Returns', 'Not sure yet',
];

$name    = qp_clean_line((string) ($_POST['name'] ?? ''), 80);
$email   = qp_clean_line((string) ($_POST['email'] ?? ''), 120);
$company = qp_clean_line((string) ($_POST['company'] ?? ''), 120);
$service = qp_clean_line((string) ($_POST['service'] ?? ''), 80);
$message = qp_clean_text((string) ($_POST['message'] ?? ''), 2000);
$consent = (string) ($_POST['consent'] ?? '') === 'yes';

$errors = [];
if (mb_strlen($name) < 2)                                   $errors['name'] = 'Please enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))             $errors['email'] = 'Please enter a valid email address.';
if (!in_array($service, $services, true))                   $errors['service'] = 'Please choose a service.';
if (mb_strlen($message) < 10)                               $errors['message'] = 'Please tell us a little about what you need.';
if (!$consent)                                              $errors['consent'] = 'Please confirm you agree to us using your details to respond.';
if ($errors) {
    qp_json(422, ['ok' => false, 'error' => 'Please check the highlighted fields.', 'fields' => $errors]);
}

$to   = (string) qp_cfg('contact_to', '');
$from = (string) qp_cfg('contact_from', '');
if ($to === '' || $from === '') {
    error_log('contact.php: contact_to / contact_from not configured');
    qp_json(503, ['ok' => false, 'error' => 'The enquiry service is not configured yet. Please email us directly.']);
}

$when = gmdate('Y-m-d H:i') . ' UTC';
$ip   = qp_client_ip();

// Private log line (JSON Lines), kept outside public_html.
$logFile = qp_storage_dir() . '/enquiries.log';
@file_put_contents($logFile, json_encode([
    'at' => $when, 'ip' => $ip, 'name' => $name, 'email' => $email, 'company' => $company,
    'service' => $service, 'message' => $message,
], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

$subject = 'Website enquiry: ' . $service . ' — ' . $name;
$body = "New enquiry from the website\n"
      . "----------------------------\n"
      . "Name:     {$name}\n"
      . "Email:    {$email}\n"
      . "Company:  " . ($company !== '' ? $company : '-') . "\n"
      . "Service:  {$service}\n"
      . "Consent:  yes (privacy policy)\n"
      . "Received: {$when}\n"
      . "IP:       {$ip}\n\n"
      . "Message:\n{$message}\n";

$siteHost = parse_url(qp_site_origin(), PHP_URL_HOST) ?: 'localhost';
$headers = [
    'From: Quantact Partners website <' . $from . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: quantact-site',
    'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . $siteHost . '>',
];
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = @mail($to, $encodedSubject, $body, implode("\r\n", $headers), '-f' . $from);
if (!$sent) {
    error_log('contact.php: mail() returned false');
    qp_json(502, ['ok' => false, 'error' => 'Your enquiry was recorded but the email could not be sent. We will still see it; you can also email us directly.']);
}

qp_json(200, ['ok' => true]);
