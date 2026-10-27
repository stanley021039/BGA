$ErrorActionPreference = 'Stop'
while ($null -ne ($line = [Console]::ReadLine())) {
  try {
    $query = $line | ConvertFrom-Json
    $ids = @($query.pids | ForEach-Object { [int]$_ })
    $processes = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
    $cpu = ($processes | ForEach-Object { $_.TotalProcessorTime.TotalSeconds } | Measure-Object -Sum).Sum
    $rss = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
    $private = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
    $gpuMemory = @()
    $engines = @()
    $gpuError = $null
    try {
      $gpuMemory = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory | Where-Object { $_.Name -match '^pid_(\d+)_' -and $ids -contains [int]$Matches[1] })
      $engines = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -match '^pid_(\d+)_' -and $ids -contains [int]$Matches[1] } | ForEach-Object { @{ engine = $_.Name; percent = [double]$_.UtilizationPercentage } })
    } catch { $gpuError = $_.Exception.Message }
    if (!$gpuMemory.Count -and !$gpuError) { $gpuError = 'No matching WDDM GPU process-memory counter instances' }
    $dedicated = if ($gpuMemory.Count) { ($gpuMemory | Measure-Object -Property DedicatedUsage -Sum).Sum } else { $null }
    $shared = if ($gpuMemory.Count) { ($gpuMemory | Measure-Object -Property SharedUsage -Sum).Sum } else { $null }
    @{ cpuSeconds = $cpu; rssBytes = $rss; privateBytes = $private; processes = $processes.Count; gpu = @{ source = 'Windows WDDM per-process counters'; available = [bool]$gpuMemory.Count; dedicatedBytes = $dedicated; sharedBytes = $shared; engines = $engines; reason = $gpuError } } | ConvertTo-Json -Depth 6 -Compress | Write-Output
  } catch { @{ error = $_.Exception.Message } | ConvertTo-Json -Compress | Write-Output }
}
