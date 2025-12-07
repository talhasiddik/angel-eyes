# Stop all Angel Eyes services
Write-Host "======================================================================"
Write-Host "STOPPING ALL ANGEL EYES SERVICES"
Write-Host "======================================================================"
Write-Host ""

# Function to kill process on port
function Stop-ServiceOnPort {
    param($port, $serviceName)
    
    Write-Host "Stopping $serviceName (port $port)..."
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($process) {
        foreach ($pid in $process) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed process $pid"
        }
    } else {
        Write-Host "  No process running on port $port"
    }
}

# Stop all services
Stop-ServiceOnPort -port 5000 -serviceName "Node.js Backend Server"
Stop-ServiceOnPort -port 5001 -serviceName "AI Service"
Stop-ServiceOnPort -port 5002 -serviceName "Webcam Server"
Stop-ServiceOnPort -port 8081 -serviceName "React Native Metro"
Stop-ServiceOnPort -port 19000 -serviceName "Expo Metro"
Stop-ServiceOnPort -port 19001 -serviceName "Expo DevTools"
Stop-ServiceOnPort -port 19002 -serviceName "Expo Web"

# Also kill any remaining node/python processes related to the project
Write-Host ""
Write-Host "Stopping remaining Node.js and Python processes..."

Get-Process node -ErrorAction SilentlyContinue | 
    Where-Object { $_.Path -like "*FYP\Development*" } | 
    ForEach-Object { 
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed Node process $($_.Id)"
    }

Get-Process python -ErrorAction SilentlyContinue | 
    Where-Object { $_.Path -like "*FYP\Development*" } | 
    ForEach-Object { 
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed Python process $($_.Id)"
    }

Write-Host ""
Write-Host "======================================================================"
Write-Host "ALL SERVICES STOPPED"
Write-Host "======================================================================"
Write-Host ""
Read-Host "Press Enter to exit"
