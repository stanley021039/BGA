$settings = @{}
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*(PORT|RADMIN_INTERFACE|VPN_SUBNET)\s*=\s*(.*?)\s*$') {
            $settings[$Matches[1]] = $Matches[2].Trim('"', "'")
        }
    }
}
$port = if ($env:PORT) { [int]$env:PORT } elseif ($settings.PORT) { [int]$settings.PORT } else { 3000 }
if ($port -lt 1 -or $port -gt 65535) { throw 'Invalid PORT' }
$interface = if ($env:RADMIN_INTERFACE) { $env:RADMIN_INTERFACE } elseif ($settings.RADMIN_INTERFACE) { $settings.RADMIN_INTERFACE } else { 'Radmin VPN' }
$subnet = if ($env:VPN_SUBNET) { $env:VPN_SUBNET } elseif ($settings.VPN_SUBNET) { $settings.VPN_SUBNET } else { '26.0.0.0/8' }
$vpnAddress = (Get-NetIPAddress -InterfaceAlias $interface -AddressFamily IPv4 -ErrorAction Stop).IPAddress
New-NetFirewallRule -DisplayName 'Afterhours - Radmin VPN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -LocalAddress $vpnAddress -RemoteAddress $subnet -Profile Any
