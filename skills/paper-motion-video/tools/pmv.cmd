@echo off
rem paper-motion-video command line for Windows cmd and PowerShell (tools/pmv does the same for macOS, Linux and Git Bash).
rem Usage: tools\pmv.cmd COMMAND [ARGS]   (tools\pmv.cmd help). The first call sets up the environment (a venv, then install.py).
setlocal
if not defined PMV_HOME set "PMV_HOME=%USERPROFILE%\.cache\paper-motion-video"
set "HF_HOME=%PMV_HOME%\hf"
set "PYTHONNOUSERSITE=1"
set "PYTHONWARNINGS=ignore"
set "PYTHONUTF8=1"
set "VENV=%PMV_HOME%\venv"
set "PY=%VENV%\Scripts\python.exe"
if /i "%~1"=="setup" (
  del "%PMV_HOME%\.ready" 2>nul
  call :setup
  exit /b
)
if not exist "%PMV_HOME%\.ready" (
  call :setup || exit /b 1
)
"%PY%" "%~dp0pmv.py" %*
exit /b

:setup
if not exist "%PMV_HOME%" mkdir "%PMV_HOME%"
if exist "%PY%" goto install
if exist "%VENV%" rmdir /s /q "%VENV%"
rem A Python 3.10-3.12 (the Kokoro voice model does not support 3.13 yet); py is the Windows launcher
for %%c in (python3.12 python3.11 python3.10 "py -3.12" "py -3.11" "py -3.10" python3 python) do (
  %%~c -c "import sys; sys.exit(sys.version_info[:2] not in ((3, 10), (3, 11), (3, 12)))" <nul >nul 2>&1 && (
    >&2 echo [pmv setup] creating venv with %%~c
    %%~c -m venv "%VENV%" && goto install
    rmdir /s /q "%VENV%" 2>nul
  )
)
where uv >nul 2>&1 && (
  >&2 echo [pmv setup] creating venv with uv ^(Python 3.12^)
  uv venv --seed --python 3.12 "%VENV%" && goto install
)
>&2 echo paper-motion-video needs Python 3.10-3.12 (the Kokoro voice model does not support 3.13 yet).
>&2 echo Install one, e.g. 'winget install Python.Python.3.12' or 'uv python install 3.12', then re-run.
exit /b 1

:install
"%PY%" "%~dp0install.py"
exit /b
