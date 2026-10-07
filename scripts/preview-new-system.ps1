param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [int]$Port = 3001,
  [ValidateSet('readonly', 'development')]
  [string]$Mode = 'readonly'
)

$ErrorActionPreference = 'Stop'
$worktreeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = (Resolve-Path $EnvFile).Path

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "Arquivo de ambiente não encontrado: $envPath"
}

Set-Location $worktreeRoot
$env:DOTENV_CONFIG_PATH = $envPath
$env:PORT = [string]$Port
$env:NODE_ENV = 'development'
$env:RK_READ_ONLY_PREVIEW = if ($Mode -eq 'readonly') { '1' } else { '0' }
$env:VITE_HMR_PORT = [string]($Port + 10000)

# Use um cache isolado por processo. O cache dentro de node_modules pode ficar
# bloqueado por outra janela/agente no Windows e causar EPERM no startup.
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'rk-sucatas-local'
$cacheDir = Join-Path $tempRoot "vite-$Port-$PID"
$serverBundle = Join-Path $worktreeRoot ".tmp-rk-sucatas-server-$Port-$PID.mjs"
New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
$env:VITE_CACHE_DIR = $cacheDir

Write-Host "PROJETO: RK Sucatas — NOVO SISTEMA"
Write-Host "DIRETORIO: $worktreeRoot"
Write-Host "Iniciando o novo sistema em http://127.0.0.1:$Port/tarefas"
Write-Host "A porta 4173 pertence ao projeto legado e não deve ser usada para validar este checkout."
Write-Host "Arquivo de ambiente carregado de forma privada: $envPath"

$existingConnection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $existingConnection) {
  # Get-NetTCPConnection pode omitir listeners de outro contexto no Windows;
  # netstat é o fallback confiável para o diagnóstico de porta.
  $netstatLine = netstat -ano -p tcp | Select-String -Pattern (":$Port\s+.*LISTENING\s+\d+$") | Select-Object -First 1
  if ($netstatLine -and $netstatLine.Line -match '\s(?<pid>\d+)\s*$') {
    $existingConnection = [pscustomobject]@{ OwningProcess = [int]$Matches.pid }
  }
}
if ($existingConnection) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 -ErrorAction Stop
    if ($health.status -eq 'ok') {
      Write-Host "O novo sistema já está rodando em http://127.0.0.1:$Port. Reutilizando a instância existente."
      exit 0
    }
  } catch {
    # A porta pode estar ocupada por outro processo; a mensagem abaixo torna
    # a origem do conflito explícita sem encerrar nenhum processo externo.
  }
  throw "A porta $Port já está em uso pelo processo $($existingConnection.OwningProcess). Encerre somente o servidor deste checkout ou escolha outra porta com -Port."
}

$projectNode = Join-Path $worktreeRoot 'node_modules\node\bin\node.exe'
$esbuildCli = Join-Path $worktreeRoot 'node_modules\esbuild\bin\esbuild'

if (-not (Test-Path -LiteralPath $projectNode)) {
  $projectNode = (Get-Command node -ErrorAction SilentlyContinue).Source
}

try {
  if ((Test-Path -LiteralPath $projectNode) -and (Test-Path -LiteralPath $esbuildCli)) {
  # Em alguns ambientes Windows o tsx falha antes de carregar o servidor com
  # uv_os_get_passwd/ENOMEM. O bundle temporário elimina somente esse loader:
  # o Express continua servindo Vite e a API no mesmo processo e na mesma porta.
  & $projectNode $esbuildCli 'server.ts' '--bundle' '--platform=node' '--format=esm' '--packages=external' "--outfile=$serverBundle"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not prepare the new system local server."
  }

    & $projectNode $serverBundle
  } else {
    throw 'Node.js ou esbuild não encontrado em node_modules. Execute npm install e tente novamente.'
  }
} finally {
  if (Test-Path -LiteralPath $serverBundle) {
    Remove-Item -LiteralPath $serverBundle -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $cacheDir) {
    Remove-Item -LiteralPath $cacheDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
