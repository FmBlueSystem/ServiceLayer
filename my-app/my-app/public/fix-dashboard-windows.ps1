# Fix dashboard.html - Remove duplicate username

$dashFile = "C:\ServiceLayer\public\dashboard.html"
$content = Get-Content $dashFile -Raw -Encoding UTF8

# Remove the username span from header-left section
$content = $content -replace '<span>👤 <span id="username">Usuario</span></span>\s*<div class="connection-indicators">', '<div class="connection-indicators">'

# Also update the JavaScript to only set usernameHeader
$content = $content -replace "// Set username in both places\s*document\.getElementById\('username'\)\.textContent = authData\.username;\s*document\.getElementById\('usernameHeader'\)\.textContent = authData\.username;", "// Set username in header`n            document.getElementById('usernameHeader').textContent = authData.username;"

# Save the file
$content | Set-Content $dashFile -Encoding UTF8

Write-Host "Dashboard fixed successfully!"
Write-Host "Press Ctrl+F5 in your browser to reload with cleared cache"
