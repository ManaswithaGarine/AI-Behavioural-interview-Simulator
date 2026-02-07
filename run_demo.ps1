# Demo script: runs a 5-question automated interview and writes output to demo-output.txt
$outFile = Join-Path $PSScriptRoot 'demo-output.txt'
if (Test-Path $outFile) { Remove-Item $outFile }

$answers = @(
  'Short answer: I helped.',
  'Moderate answer: I was responsible for implementing a solution; I coordinated with teammates, implemented changes and we improved performance by about 20%.',
  'Strong answer: I led a cross-functional initiative where I coordinated 4 engineers, designed and implemented a new caching layer, and reduced page load time by 40% within two months; stakeholders reported improved metrics and customer satisfaction increased.'
)

foreach ($ans in $answers) {
  "================ Demo Session - Answer Style: $ans ================" | Out-File $outFile -Append
  $questions = Invoke-RestMethod http://localhost:3000/questions
  $start = Invoke-RestMethod -Method Post http://localhost:3000/start
  $sessionId = $start.sessionId
  "Session: $sessionId" | Out-File $outFile -Append
  for ($i=0; $i -lt $questions.questions.Count; $i++) {
    $q = $questions.questions[$i]
    "---" | Out-File $outFile -Append
    ("Q{0}: {1}" -f ($i+1), $q) | Out-File $outFile -Append
    $payload = @{ sessionId=$sessionId; questionIndex=$i; question=$q; answer=$ans }
    $r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/answer -ContentType 'application/json' -Body ($payload | ConvertTo-Json)
    ("STAR: S:{0} T:{1} A:{2} R:{3} => {4}/8" -f $r.entry.star.situation, $r.entry.star.task, $r.entry.star.action, $r.entry.star.result, $r.entry.star.total) | Out-File $outFile -Append
    foreach ($s in $r.entry.suggestions) { (" - {0}" -f $s) | Out-File $outFile -Append }
  }
  "=== Summary ===" | Out-File $outFile -Append
  $summary = Invoke-RestMethod ("http://localhost:3000/summary?sessionId=$sessionId")
  $summary | ConvertTo-Json -Depth 5 | Out-File $outFile -Append
  "`n" | Out-File $outFile -Append
}

Write-Output "Demo finished. Output written to $outFile"
