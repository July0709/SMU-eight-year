# Batch-convert all .doc/.docx in the vault to PDF next to the originals,
# using Microsoft Word COM. Skips targets that already exist.
$root = 'C:\D\SMU-eight-year'
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  ($_.Extension -ieq '.doc' -or $_.Extension -ieq '.docx') -and
  $_.FullName -notlike '*\site\*' -and
  $_.FullName -notlike '*\.git\*' -and
  $_.Name -notlike '~$*'
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try { $word.DisplayAlerts = 0 } catch {}

$converted = 0
$skipped = 0
$failed = @()

foreach ($f in $files) {
  $pdf = [System.IO.Path]::ChangeExtension($f.FullName, '.pdf')
  if (Test-Path $pdf) { $skipped++; continue }
  try {
    # Open(FileName, ConfirmConversions=$false, ReadOnly=$true, AddToRecentFiles=$false)
    $doc = $word.Documents.Open($f.FullName, $false, $true, $false)
    $doc.SaveAs2($pdf, 17) # wdFormatPDF
    $doc.Close($false)
    $converted++
    Write-Output "OK: $($f.FullName.Substring($root.Length + 1))"
  } catch {
    $failed += $f.FullName
    Write-Output "FAIL: $($f.FullName) -- $($_.Exception.Message)"
    try { $word.ActiveDocument.Close($false) } catch {}
  }
}

try { $word.Quit() } catch {}
Write-Output "SUMMARY converted=$converted skipped=$skipped failed=$($failed.Count)"
