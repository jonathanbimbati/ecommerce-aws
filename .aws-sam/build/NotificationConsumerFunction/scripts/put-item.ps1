param(
  [string] $TableName = "ecommerce-aws-Products",
  [string] $Region = "us-east-1",
  [string] $ItemFile = "item.json"
)

$full = Join-Path -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) -ChildPath "..\$ItemFile"
Write-Output "Using item file: $full"
aws dynamodb put-item --table-name $TableName --item "file://$full" --region $Region
