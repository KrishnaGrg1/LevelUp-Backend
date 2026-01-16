# Script to check for missing translation keys in error.json

Write-Host "=== Translation Key Checker ===" -ForegroundColor Cyan
Write-Host ""

# Read the error translation file
$errorJson = Get-Content "src\translation\eng\error.json" -Raw | ConvertFrom-Json

# Function to check if a key exists in the JSON
function Test-TranslationKey {
    param(
        [string]$Key,
        [object]$JsonObject
    )
    
    # Split the key (e.g., "error.auth.not_authenticated" -> ["auth", "not_authenticated"])
    $parts = $Key -replace '^error\.', '' -split '\.'
    
    if ($parts.Length -ne 2) {
        return $false
    }
    
    $category = $parts[0]
    $subkey = $parts[1]
    
    # Check if the category exists
    $categoryObj = $JsonObject.$category
    if (-not $categoryObj) {
        return $false
    }
    
    # Check if the subkey exists
    return [bool]($categoryObj.PSObject.Properties.Name -contains $subkey)
}

# Search for all error keys in the codebase
Write-Host "Searching for error keys in codebase..." -ForegroundColor Yellow
$pattern = "'error\.[a-zA-Z_]+\.[a-zA-Z_0-9]+'"
$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse

$allKeys = @()
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $matches = [regex]::Matches($content, $pattern)
    foreach ($match in $matches) {
        $key = $match.Value.Trim("'")
        if ($allKeys -notcontains $key) {
            $allKeys += $key
        }
    }
}

Write-Host "Found $($allKeys.Count) unique error keys" -ForegroundColor Green
Write-Host ""

# Check each key
$missingKeys = @()
$existingKeys = @()

foreach ($key in $allKeys | Sort-Object) {
    if (Test-TranslationKey -Key $key -JsonObject $errorJson) {
        $existingKeys += $key
    } else {
        $missingKeys += $key
    }
}

# Display results
Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total keys found: $($allKeys.Count)" -ForegroundColor White
Write-Host "Existing in translation: $($existingKeys.Count)" -ForegroundColor Green
Write-Host "Missing from translation: $($missingKeys.Count)" -ForegroundColor Red
Write-Host ""

if ($missingKeys.Count -gt 0) {
    Write-Host "=== MISSING KEYS ===" -ForegroundColor Red
    Write-Host "The following keys are used in code but NOT in translation file:" -ForegroundColor Yellow
    Write-Host ""
    
    # Group by category
    $groupedMissing = $missingKeys | Group-Object { ($_ -split '\.')[1] }
    
    foreach ($group in $groupedMissing | Sort-Object Name) {
        Write-Host "Category: $($group.Name)" -ForegroundColor Magenta
        foreach ($key in $group.Group | Sort-Object) {
            Write-Host "  - $key" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    # Generate JSON to add
    Write-Host "=== SUGGESTED ADDITIONS ===" -ForegroundColor Cyan
    Write-Host "Add these to your error.json file:" -ForegroundColor Yellow
    Write-Host ""
    
    $suggestions = @{}
    foreach ($key in $missingKeys) {
        $parts = $key -replace '^error\.', '' -split '\.'
        $category = $parts[0]
        $subkey = $parts[1]
        
        if (-not $suggestions.ContainsKey($category)) {
            $suggestions[$category] = @{}
        }
        
        # Generate a human-readable message
        $message = ($subkey -replace '_', ' ').ToUpper()[0] + ($subkey -replace '_', ' ').Substring(1)
        $suggestions[$category][$subkey] = $message
    }
    
    foreach ($category in $suggestions.Keys | Sort-Object) {
        Write-Host """$category"": {" -ForegroundColor White
        foreach ($subkey in $suggestions[$category].Keys | Sort-Object) {
            Write-Host "  ""$subkey"": ""$($suggestions[$category][$subkey])""," -ForegroundColor White
        }
        Write-Host "}" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host "✓ All error keys are properly translated!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== EXISTING KEYS (Sample) ===" -ForegroundColor Cyan
Write-Host "First 10 existing keys:" -ForegroundColor Yellow
$existingKeys | Select-Object -First 10 | ForEach-Object {
    Write-Host "  ✓ $_" -ForegroundColor Green
}
if ($existingKeys.Count -gt 10) {
    Write-Host "  ... and $($existingKeys.Count - 10) more" -ForegroundColor Gray
}
