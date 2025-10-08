param(
  [string] $Url = "http://localhost:3000/api/products",
  [string] $Name = "Produto Local",
  [string] $Price = "29.9",
  [string] $Description = "Seed local via backend"
)

$body = @{ name = $Name; price = [double]$Price; description = $Description } | ConvertTo-Json
Write-Output "POST $Url"
Write-Output $body

Invoke-RestMethod -Method Post -Uri $Url -Body $body -ContentType 'application/json'
