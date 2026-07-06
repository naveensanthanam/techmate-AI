@echo off
echo Starting TechDoc server...
start python -m http.server 8080
ping 127.0.0.1 -n 3 > nul
echo Opening browser...
start http://127.0.0.1:8080/index.html
exit
