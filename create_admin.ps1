param(
    [Parameter(Mandatory = $true)]
    [string]$Email
)

$password = Read-Host 'Masukkan password admin baru (minimal 8 karakter)' -AsSecureString
$confirmation = Read-Host 'Ulangi password admin baru' -AsSecureString

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $confirmedPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)

    if ($plainPassword.Length -lt 8) {
        throw 'Password harus memiliki minimal 8 karakter.'
    }
    if ($plainPassword -cne $confirmedPassword) {
        throw 'Password yang dimasukkan tidak sama.'
    }

    $env:LIBRARY_ADMIN_PASSWORD = $plainPassword
    & php (Join-Path $PSScriptRoot 'create_admin.php') $Email 'Admin Perpustakaan'
    if ($LASTEXITCODE -ne 0) {
        throw 'Pembuatan akun admin gagal. Periksa koneksi MySQL dan apakah email sudah terdaftar.'
    }
}
finally {
    Remove-Item Env:\LIBRARY_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    if ($confirmationPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer)
    }
    $plainPassword = $null
    $confirmedPassword = $null
}
