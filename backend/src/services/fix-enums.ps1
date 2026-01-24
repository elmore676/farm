$content = Get-Content "notification-triggers.service.ts" -Raw
$content = $content -replace "NotificationType\.(\w+)", "'`$1'"
$content = $content -replace "NotificationChannel\.(\w+)", "'`$1'"
$content = $content -replace "NotificationPriority\.(\w+)", "'`$1'"
Set-Content "notification-triggers.service.ts" -Value $content
Write-Host "Replacement complete"
