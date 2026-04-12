Write-Host "Launching 1 Ollama instance (11435) with gemma2:2b preloaded..."

$ports = 11435..11435

foreach ($p in $ports) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "
        `$env:OLLAMA_HOST='127.0.0.1:$p';
        Write-Host ('Starting Ollama on port ' + $p + ' ...');
        Start-Job { ollama serve } | Out-Null;
        Start-Sleep -Seconds 3;
        Write-Host ('Preloading gemma2:2b on port ' + $p + ' ...');
        ollama run gemma2:2b;
    "
    Start-Sleep -Milliseconds 500
}

Write-Host "All Ollama instances launched and preloading gemma2:2b."
Write-Host "Use 'netstat -ano | findstr 1143' to confirm they are listening."
