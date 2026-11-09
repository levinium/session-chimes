# Plays a WAV with a lead-in of silence and a volume, for session-chimes on Windows.
# Wireless headsets drop the start of a sound while they wake from idle, so the
# lead-in is real silence in the stream, not a pause before it.
param(
    [Parameter(Mandatory)] [string] $Path,
    [int] $Volume = 100,
    [int] $LeadMs = 1000
)
$ErrorActionPreference = 'Stop'

$bytes = [System.IO.File]::ReadAllBytes($Path)
if ($bytes.Length -lt 12 -or [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') {
    throw "not a WAV file: $Path"
}

# Find the fmt and data chunks.
$fmt = $null; $dataAt = -1; $dataLen = 0; $pos = 12
while ($pos + 8 -le $bytes.Length) {
    $id = [Text.Encoding]::ASCII.GetString($bytes, $pos, 4)
    $len = [BitConverter]::ToInt32($bytes, $pos + 4)
    if ($id -eq 'fmt ') { $fmt = $bytes[($pos + 8)..($pos + 8 + $len - 1)] }
    if ($id -eq 'data') { $dataAt = $pos + 8; $dataLen = [Math]::Min($len, $bytes.Length - $dataAt); break }
    $pos += 8 + $len + ($len % 2)
}

$stream = $null
if ($fmt -and $dataAt -ge 0) {
    $format = [BitConverter]::ToInt16($fmt, 0)
    $channels = [BitConverter]::ToInt16($fmt, 2)
    $rate = [BitConverter]::ToInt32($fmt, 4)
    $bits = [BitConverter]::ToInt16($fmt, 14)
    $frame = [Math]::Max(1, $channels * $bits / 8)

    if ($format -eq 1) {
        $data = New-Object byte[] $dataLen
        [Array]::Copy($bytes, $dataAt, $data, 0, $dataLen)

        if ($bits -eq 16 -and $Volume -lt 100) {
            $gain = [Math]::Max(0, $Volume) / 100.0
            for ($i = 0; $i + 1 -lt $data.Length; $i += 2) {
                $s = [int]([BitConverter]::ToInt16($data, $i) * $gain)
                $data[$i] = [byte]($s -band 0xFF)
                $data[$i + 1] = [byte](($s -shr 8) -band 0xFF)
            }
        }

        $leadLen = [int]($rate * [Math]::Max(0, $LeadMs) / 1000) * $frame
        $lead = New-Object byte[] $leadLen
        if ($bits -eq 8) { for ($i = 0; $i -lt $leadLen; $i++) { $lead[$i] = 128 } }

        $stream = New-Object System.IO.MemoryStream
        $w = New-Object System.IO.BinaryWriter $stream
        $w.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
        $w.Write([int](4 + 8 + $fmt.Length + 8 + $leadLen + $data.Length))
        $w.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
        $w.Write([int]$fmt.Length); $w.Write([byte[]]$fmt)
        $w.Write([Text.Encoding]::ASCII.GetBytes('data'))
        $w.Write([int]($leadLen + $data.Length)); $w.Write($lead); $w.Write($data)
        $w.Flush(); $stream.Position = 0
    }
}

# A format this script cannot rewrite plays as it is.
$player = if ($stream) { New-Object System.Media.SoundPlayer $stream } else { New-Object System.Media.SoundPlayer $Path }
$player.PlaySync()
