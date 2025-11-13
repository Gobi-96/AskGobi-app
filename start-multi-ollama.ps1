Write-Host "Launching 2 Ollama instances (11435-11436) with llama3 preloaded..."

$ports = 11435..11436

foreach ($p in $ports) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "
        `$env:OLLAMA_HOST='127.0.0.1:$p';
        Write-Host ('Starting Ollama on port ' + $p + ' ...');
        Start-Job { ollama serve } | Out-Null;
        Start-Sleep -Seconds 3;
        Write-Host ('Preloading llama3 on port ' + $p + ' ...');
        ollama run llama3;
    "
    Start-Sleep -Milliseconds 500
}

Write-Host "All Ollama instances launched and preloading llama3."
Write-Host "Use 'netstat -ano | findstr 1143' to confirm they are listening."
