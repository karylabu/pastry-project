@echo off
REM ============================================================
REM Pastry Project - full database backup
REM Usage:  database\backup_db.bat
REM Output: database\backups\pastry_db_YYYYMMDD_HHMMSS.sql
REM
REM ALWAYS run this before applying any migration.
REM Restore with:
REM   mysql -u root pastry_db < backups\pastry_db_YYYYMMDD_HHMMSS.sql
REM ============================================================

setlocal
set STAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set STAMP=%STAMP: =0%
set OUTDIR=%~dp0backups

if not exist "%OUTDIR%" mkdir "%OUTDIR%"

C:\xampp\mysql\bin\mysqldump.exe -u root --single-transaction --routines --triggers pastry_db > "%OUTDIR%\pastry_db_%STAMP%.sql"

if %errorlevel% neq 0 (
    echo BACKUP FAILED.
    exit /b 1
)
echo Backup written to %OUTDIR%\pastry_db_%STAMP%.sql
endlocal