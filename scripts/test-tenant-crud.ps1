# Test Tenant CRUD flow end-to-end
param([string]$Slug = "tjahaja-baru", [string]$Username = "superadmin", [string]$Password = "admin123")

$ErrorActionPreference = "Continue"
$base = "http://localhost:3000"
$session = $null

function Show-Result($name, $statusCode, $body) {
    if ($statusCode -ge 200 -and $statusCode -lt 300) {
        Write-Host "  [PASS] $name (HTTP $statusCode)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $name (HTTP $statusCode)" -ForegroundColor Red
        Write-Host "         $body" -ForegroundColor DarkRed
    }
}

function Try-Request {
    param($Method, $Url, $Body, $Name)
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            WebSession = $script:session
        }
        if ($Body) {
            $params.ContentType = "application/json"
            $params.Body = $Body
        }
        $r = Invoke-WebRequest @params
        Show-Result $Name $r.StatusCode $r.Content
        return @{ Status = $r.StatusCode; Body = $r.Content; Object = ($r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue) }
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $body = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        Show-Result $Name $code $body
        return @{ Status = $code; Body = $body; Object = $null }
    }
}

Write-Host "=== Login as $Username for tenant $Slug ===" -ForegroundColor Cyan
$loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $r = Invoke-WebRequest -Uri "$base/api/$Slug/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing -WebSession $session
    Show-Result "Login" $r.StatusCode $r.Content
} catch {
    Show-Result "Login" ([int]$_.Exception.Response.StatusCode) $_.ErrorDetails.Message
    exit 1
}

Write-Host ""
Write-Host "=== Session ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/auth/session" -Name "GET session" | Out-Null

Write-Host ""
Write-Host "=== Dashboard stats ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/dashboard" -Name "GET dashboard" | Out-Null

Write-Host ""
Write-Host "=== Machines CRUD ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/machines" -Name "GET machines list" | Out-Null

$createMachineBody = @{
    kodeDealer = "TST"
    namaDealer = "Test Branch"
    serialNumber = "TEST-SN-001"
    password = "machinepass"
} | ConvertTo-Json
$mResult = Try-Request -Method POST -Url "$base/api/$Slug/machines" -Body $createMachineBody -Name "POST create machine"
$machineId = if ($mResult.Object) { $mResult.Object.id } else { $null }

if ($machineId) {
    $updateBody = @{ namaDealer = "Test Branch Updated" } | ConvertTo-Json
    Try-Request -Method PUT -Url "$base/api/$Slug/machines/$machineId" -Body $updateBody -Name "PUT update machine" | Out-Null
}

Write-Host ""
Write-Host "=== Employees CRUD ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/employees" -Name "GET employees list" | Out-Null

$createEmpBody = @{
    kodeKaryawan = "EMP001"
    namaKaryawan = "Test Karyawan"
    branches = @("TST")
} | ConvertTo-Json
$eResult = Try-Request -Method POST -Url "$base/api/$Slug/employees" -Body $createEmpBody -Name "POST create employee"
$employeeId = if ($eResult.Object) { $eResult.Object.id } else { $null }

if ($employeeId) {
    Try-Request -Method DELETE -Url "$base/api/$Slug/employees/$employeeId" -Name "DELETE employee" | Out-Null
}

Write-Host ""
Write-Host "=== Users CRUD ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/users" -Name "GET users list" | Out-Null

$createUserBody = @{
    username = "testhrd"
    password = "TestPass123"
    role = "HRD"
} | ConvertTo-Json
$uResult = Try-Request -Method POST -Url "$base/api/$Slug/users" -Body $createUserBody -Name "POST create user"
$userId = if ($uResult.Object) { $uResult.Object.id } else { $null }

if ($userId) {
    Try-Request -Method DELETE -Url "$base/api/$Slug/users/$userId" -Name "DELETE user" | Out-Null
}

Write-Host ""
Write-Host "=== Branch Schedule ===" -ForegroundColor Cyan
Try-Request -Method GET -Url "$base/api/$Slug/settings/schedule" -Name "GET schedules" | Out-Null

Write-Host ""
Write-Host "=== Reports ===" -ForegroundColor Cyan
$today = (Get-Date).ToString("yyyy-MM-dd")
Try-Request -Method GET -Url "$base/api/$Slug/reports?startDate=$today&endDate=$today" -Name "GET reports" | Out-Null

Write-Host ""
Write-Host "=== Cleanup test machine ===" -ForegroundColor Cyan
if ($machineId) {
    Try-Request -Method DELETE -Url "$base/api/$Slug/machines/$machineId" -Name "DELETE machine" | Out-Null
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
