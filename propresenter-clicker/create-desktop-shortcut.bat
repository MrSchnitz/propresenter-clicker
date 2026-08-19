@echo off
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\ProPresenter Clicker.lnk'); $lnk.TargetPath = '%~dp0start.bat'; $lnk.WorkingDirectory = '%~dp0'; $lnk.Save()"
echo Shortcut 'ProPresenter Clicker' created on the Desktop.
pause
