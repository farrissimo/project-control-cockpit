# Fixture mirroring the real JSON scripts' output pattern, but with a hostile
# set of non-ASCII characters (accents, smart quotes, en/em dashes, arrows,
# checkmarks). If the UTF-8 output guard works, node's JSON.parse round-trips
# these exactly. Without it, PowerShell writes OEM-codepage bytes and the JSON
# is invalid — the failure the Recent-decisions panel actually hit.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$o = [ordered]@{
  items = @(
    'Renee accent: Renée - decisao: decisão check: ✓',
    'Claude -> Codex arrow: Claude → Codex',
    'Smart quotes: Owner''s “checkpoint”',
    'Dashes: en–dash em—dash',
    'Section sign: §7.22'
  )
}
$o | ConvertTo-Json -Depth 5
